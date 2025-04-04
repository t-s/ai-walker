class Walker {
    constructor(shapes, world) {
        this.world = world;
        this.bodyParts = [];
        this.joints = [];
        this.timeStep = 0;
        this.simulationSpeed = 0.005; // Extremely slow simulation speed
        this.learningRate = 0.0001; // Very slow learning for stability
        this.forwardBias = 0.05; // Minimal forward bias to prevent veering off screen
        this.successfulMoves = [];
        this.lastPosition = null;
        this.stuckCounter = 0;
        this.appendages = [];
        this.mainBody = null;
        this.debugMode = true; // Enable visualization of push-off and recovery phases
        
        this.createFromShapes(shapes);
        this.setupAIBehavior();
    }
    
    createFromShapes(shapes) {
        // Create a more creature-like arrangement based on shapes
        const baseY = height - 100;
        
        // If we have multiple shapes, treat the largest as the main body
        if (shapes.length > 0) {
            // Find the largest shape by area (approximated by point count)
            let largestShapeIndex = 0;
            let maxPoints = shapes[0].length;
            
            for (let i = 1; i < shapes.length; i++) {
                if (shapes[i].length > maxPoints) {
                    maxPoints = shapes[i].length;
                    largestShapeIndex = i;
                }
            }
            
            // Create main body first at the center
            let mainBodyShape = shapes[largestShapeIndex];
            
            // Calculate the size/area of the shape to determine appropriate density
            const bodyArea = this.calculateShapeArea(mainBodyShape);
            // Much higher density for the main body to make it extremely stable and heavy
            const bodyDensity = Math.min(0.2, Math.max(0.1, bodyArea / 5000)); // Higher density range
            
            this.mainBody = new Shape(mainBodyShape, this.world, width / 2, baseY, {
                friction: 0.7,
                restitution: 0.1, // Lower restitution (bounciness) for more stability
                density: bodyDensity, // Density based on size
                frictionAir: 0.02, // Increased air friction for more realistic movement
                // Set a special collision group for body parts to prevent internal collisions
                collisionFilter: {
                    group: -1,  // Negative group means it never collides with other bodies in same group
                    category: 0x0001,
                    mask: 0xFFFFFFFF
                }
            });
            
            this.bodyParts.push(this.mainBody);
            
            // Analyze main body shape to find attachment points
            const mainBodyBounds = this.getShapeBounds(mainBodyShape);
            const mainBodyCenter = {
                x: (mainBodyBounds.minX + mainBodyBounds.maxX) / 2,
                y: (mainBodyBounds.minY + mainBodyBounds.maxY) / 2
            };
            
            // Create appendages from the remaining shapes
            let appendageIndex = 0;
            for (let i = 0; i < shapes.length; i++) {
                if (i !== largestShapeIndex) {
                    const shape = shapes[i];
                    
                    // Analyze the appendage shape
                    const appendageBounds = this.getShapeBounds(shape);
                    const appendageCenter = {
                        x: (appendageBounds.minX + appendageBounds.maxX) / 2,
                        y: (appendageBounds.minY + appendageBounds.maxY) / 2
                    };
                    
                    // Determine if this is a left or right appendage based on relative position
                    const isLeftSide = appendageCenter.x < mainBodyCenter.x;
                    
                    // Find the closest connection point between appendage and body
                    let connectionInfo = this.findClosestConnectionPoint(mainBodyShape, shape);
                    
                    // Position appendage at its original position relative to the main body
                    const initialX = width / 2 + (connectionInfo.appendagePoint.x - mainBodyCenter.x);
                    const initialY = baseY + (connectionInfo.appendagePoint.y - mainBodyCenter.y);
                    
                    // Calculate the size/area of the appendage to determine appropriate density
                    const appendageArea = this.calculateShapeArea(shape);
                    // Keep appendages much lighter than body for better movement but still not too light
                    const appendageDensity = Math.min(0.01, Math.max(0.002, appendageArea / 30000));
                    
                    // Adjust starting position to maintain original relative positioning
                    const appendage = new Shape(shape, this.world, initialX, initialY, {
                        friction: 0.4,
                        restitution: 0.2,
                        density: appendageDensity, // Density based on size
                        frictionAir: 0.03, // Higher air friction for appendages
                        // Use same collision group as main body to prevent internal collisions
                        collisionFilter: {
                            group: -1, // Same group as main body so they don't collide with each other
                            category: 0x0001,
                            mask: 0xFFFFFFFF
                        }
                    });
                    
                    this.bodyParts.push(appendage);
                    this.appendages.push({
                        shape: appendage,
                        isLeftSide: isLeftSide,
                        index: appendageIndex,
                        connectionPoint: connectionInfo
                    });
                    
                    // Create joint connecting to main body at the closest connection points
                    // Convert connection points to local coordinate system of each body
                    const mainBodyLocal = {
                        x: connectionInfo.bodyPoint.x - mainBodyCenter.x,
                        y: connectionInfo.bodyPoint.y - mainBodyCenter.y
                    };
                    
                    const appendageLocal = {
                        x: connectionInfo.appendagePoint.x - appendageCenter.x,
                        y: connectionInfo.appendagePoint.y - appendageCenter.y
                    };
                    
                    // Store the original connection points for visual rendering
                    appendage.connectionPoint = {
                        bodyPoint: {
                            x: connectionInfo.bodyPoint.x,
                            y: connectionInfo.bodyPoint.y
                        },
                        appendagePoint: {
                            x: connectionInfo.appendagePoint.x,
                            y: connectionInfo.appendagePoint.y
                        },
                        bodyLocalPoint: mainBodyLocal,
                        appendageLocalPoint: appendageLocal
                    };
                    
                    // Create a very stiff constraint connecting the exact attachment points
                    const joint = Matter.Constraint.create({
                        bodyA: this.mainBody.body,
                        bodyB: appendage.body,
                        pointA: mainBodyLocal,
                        pointB: appendageLocal,
                        stiffness: 1.0,   // Maximum stiffness for rigid connection
                        length: 0,        // Zero length to keep parts tightly connected
                        damping: 0.5,     // Damping to reduce oscillations
                        render: { visible: true }
                    });
                    
                    // Add a secondary stabilizing joint to prevent separation during motion
                    const stabilizingJoint = Matter.Constraint.create({
                        bodyA: this.mainBody.body,
                        bodyB: appendage.body,
                        pointA: { 
                            x: mainBodyLocal.x + (mainBodyLocal.x > 0 ? -5 : 5), 
                            y: mainBodyLocal.y + 5
                        },
                        pointB: { 
                            x: appendageLocal.x + (appendageLocal.x > 0 ? -5 : 5), 
                            y: appendageLocal.y + 5
                        },
                        stiffness: 0.7,
                        length: 0,
                        damping: 0.5,
                        render: { visible: false }
                    });
                    
                    // Add a third stabilizing joint for even more rigidity
                    const stabilizingJoint2 = Matter.Constraint.create({
                        bodyA: this.mainBody.body,
                        bodyB: appendage.body,
                        pointA: { 
                            x: mainBodyLocal.x, 
                            y: mainBodyLocal.y - 5
                        },
                        pointB: { 
                            x: appendageLocal.x, 
                            y: appendageLocal.y - 5
                        },
                        stiffness: 0.7,
                        length: 0,
                        damping: 0.5,
                        render: { visible: false }
                    });
                    
                    Matter.Composite.add(this.world, joint);
                    Matter.Composite.add(this.world, stabilizingJoint);
                    Matter.Composite.add(this.world, stabilizingJoint2);
                    this.joints.push(joint);
                    this.joints.push(stabilizingJoint);
                    this.joints.push(stabilizingJoint2);
                    
                    appendageIndex++;
                }
            }
        } else if (shapes.length === 1) {
            // If only one shape, treat as both body and appendage
            const bodyPart = new Shape(shapes[0], this.world, width / 2, baseY, {
                friction: 0.7,
                restitution: 0.2,
                density: 0.01,
                frictionAir: 0.01
            });
            
            this.bodyParts.push(bodyPart);
            this.mainBody = bodyPart;
        }
        
        // Store initial position for learning
        if (this.bodyParts.length > 0) {
            this.lastPosition = this.bodyParts[0].body.position.x;
        }
    }
    
    // Helper method to get the bounding box of a shape
    getShapeBounds(points) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (const point of points) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        }
        
        return { minX, minY, maxX, maxY };
    }
    
    // Find the closest points between two shapes for connection
    findClosestConnectionPoint(bodyShape, appendageShape) {
        let minDistance = Infinity;
        let closestBodyPoint = null;
        let closestAppendagePoint = null;
        
        // Find the closest pair of points between the two shapes
        for (const bodyPoint of bodyShape) {
            for (const appendagePoint of appendageShape) {
                const distance = this.distance(bodyPoint, appendagePoint);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestBodyPoint = bodyPoint;
                    closestAppendagePoint = appendagePoint;
                }
            }
        }
        
        return {
            bodyPoint: closestBodyPoint,
            appendagePoint: closestAppendagePoint,
            distance: minDistance
        };
    }
    
    // Helper to calculate distance between two points
    distance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }
    
    // Calculate the approximate area of a shape (polygon)
    calculateShapeArea(points) {
        let area = 0;
        const n = points.length;
        
        // Use the Shoelace formula to calculate polygon area
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        
        area = Math.abs(area) / 2;
        return area;
    }
    
    // Prevent parts from separating by adjusting their positions if needed
    preventPartSeparation() {
        if (!this.mainBody || this.appendages.length === 0) return;
        
        for (const appendageInfo of this.appendages) {
            const appendage = appendageInfo.shape;
            const mainBody = this.mainBody;
            
            if (!appendage.connectionPoint) continue;
            
            // Get the connection points in local coordinates
            const bodyLocalPoint = appendage.connectionPoint.bodyLocalPoint;
            const appendageLocalPoint = appendage.connectionPoint.appendageLocalPoint;
            
            // Transform to world coordinates
            const bodyAngle = mainBody.body.angle;
            const appendageAngle = appendage.body.angle;
            
            // Calculate actual connection points in world space
            const mainBodyWorldPoint = {
                x: mainBody.body.position.x + 
                   (bodyLocalPoint.x * Math.cos(bodyAngle) - bodyLocalPoint.y * Math.sin(bodyAngle)),
                y: mainBody.body.position.y + 
                   (bodyLocalPoint.x * Math.sin(bodyAngle) + bodyLocalPoint.y * Math.cos(bodyAngle))
            };
            
            const appendageWorldPoint = {
                x: appendage.body.position.x + 
                   (appendageLocalPoint.x * Math.cos(appendageAngle) - appendageLocalPoint.y * Math.sin(appendageAngle)),
                y: appendage.body.position.y + 
                   (appendageLocalPoint.x * Math.sin(appendageAngle) + appendageLocalPoint.y * Math.cos(appendageAngle))
            };
            
            // Calculate distance between connection points
            const distance = Math.sqrt(
                Math.pow(appendageWorldPoint.x - mainBodyWorldPoint.x, 2) + 
                Math.pow(appendageWorldPoint.y - mainBodyWorldPoint.y, 2)
            );
            
            // If distance is too large, force direct position correction
            const maxDistance = 2; // Very strict maximum allowed separation
            if (distance > maxDistance) {
                // Calculate direction vector
                const direction = {
                    x: (appendageWorldPoint.x - mainBodyWorldPoint.x) / distance,
                    y: (appendageWorldPoint.y - mainBodyWorldPoint.y) / distance
                };
                
                // Move appendage directly to maintain connection
                const newAppendagePos = {
                    x: mainBodyWorldPoint.x + direction.x * maxDistance, 
                    y: mainBodyWorldPoint.y + direction.y * maxDistance
                };
                
                // Calculate offset from current position
                const offsetX = appendageWorldPoint.x - appendage.body.position.x;
                const offsetY = appendageWorldPoint.y - appendage.body.position.y;
                
                // Set new position directly
                Matter.Body.setPosition(appendage.body, {
                    x: newAppendagePos.x - offsetX,
                    y: newAppendagePos.y - offsetY
                });
                
                // Also match rotation/angle to maintain natural joint appearance
                const angleToMainBody = Math.atan2(
                    mainBodyWorldPoint.y - appendageWorldPoint.y,
                    mainBodyWorldPoint.x - appendageWorldPoint.x
                );
                
                // Only adjust angle for extreme cases to avoid disrupting natural physics
                const angleDiff = Math.abs(appendageAngle - bodyAngle);
                if (angleDiff > Math.PI) {
                    Matter.Body.setAngle(appendage.body, bodyAngle);
                }
            }
        }
    }
    
    setupAIBehavior() {
        // Enhanced AI behavior with adapting movement patterns
        this.movementPatterns = [];
        
        // Base movement patterns for the main body
        if (this.mainBody) {
            this.movementPatterns.push({
                bodyPart: this.mainBody,
                frequency: random(0.01, 0.03),
                amplitude: random(0.0003, 0.0008),
                phase: random(0, TWO_PI),
                direction: { x: random(0.3, 0.8), y: random(-0.1, -0.3) },
                adaptation: { x: 0, y: 0 },
                successRate: 0
            });
        }
        
        // Movement patterns for appendages - create coordinated walking motion
        if (this.appendages.length > 0) {
            // Set up an alternating gait pattern for appendages
            const leftAppendages = this.appendages.filter(a => a.isLeftSide);
            const rightAppendages = this.appendages.filter(a => !a.isLeftSide);
            
            // Sort appendages by their position relative to body (front to back)
            const sortByPosition = (a, b) => {
                const distA = abs(a.shape.body.position.y - this.mainBody.body.position.y);
                const distB = abs(b.shape.body.position.y - this.mainBody.body.position.y);
                return distA - distB;
            };
            
            leftAppendages.sort(sortByPosition);
            rightAppendages.sort(sortByPosition);
            
            // Create walking patterns with alternating phases
            const setupAppendagePatterns = (appendages, sideMultiplier) => {
                for (let i = 0; i < appendages.length; i++) {
                    const appendage = appendages[i];
                    
                    // Alternate front and back appendages to be out of phase
                    const isEven = i % 2 === 0;
                    const phaseOffset = isEven ? 0 : PI;
                    
                    // Create walking cycle with parameters based on position
                    const walkCycleSpeed = map(i, 0, appendages.length, 0.12, 0.08);
                    const walkStrength = map(i, 0, appendages.length, 1.8, 0.8);
                    
                    // Create extremely slow, deliberate movement for appendages
                    const pattern = {
                        bodyPart: appendage.shape,
                        frequency: random(0.005, 0.01),  // Extremely slow oscillation
                        amplitude: random(0.0001, 0.0003),  // Very minimal base movement
                        phase: random(0, TWO_PI) + phaseOffset,  // Alternating phase
                        direction: { 
                            x: random(0.05, 0.2) * sideMultiplier, // Minimal directional force
                            y: random(-0.1, 0.05)  // Very minimal vertical force
                        },
                        adaptation: { x: 0, y: 0 },
                        successRate: 0,
                        // Add extremely slow walking behavior
                        walkCycle: {
                            speed: walkCycleSpeed * 0.1, // Extremely slow pace
                            strength: walkStrength * 0.2, // Very gentle movement
                            phaseOffset: phaseOffset,
                            stepHeight: random(0.1, 0.3),  // Minimal lift height
                            pushForce: random(0.2, 0.5)    // Very gentle push-off force
                        }
                    };
                    
                    this.movementPatterns.push(pattern);
                }
            };
            
            // Setup patterns for both sides
            setupAppendagePatterns(leftAppendages, -1.0);  // Left side moves left
            setupAppendagePatterns(rightAppendages, 1.0);  // Right side moves right
        }
        
        // Additional random movement variations for more natural motion
        for (let i = 0; i < this.bodyParts.length; i++) {
            if (random() < 0.3) {  // 30% chance of additional random movements
                this.movementPatterns.push({
                    bodyPart: this.bodyParts[i],
                    frequency: random(0.02, 0.2),
                    amplitude: random(0.0005, 0.0025),
                    phase: random(0, TWO_PI),
                    direction: { 
                        x: random(-1, 1), 
                        y: random(-1, 1)
                    },
                    adaptation: { x: 0, y: 0 },
                    successRate: 0,
                    // Random jitter
                    jitter: random(0.0001, 0.0005)
                });
            }
        }
    }
    
    evaluateProgress() {
        // Check if we're making forward progress
        if (!this.mainBody) return;
        
        const currentX = this.mainBody.body.position.x;
        const progress = currentX - this.lastPosition;
        
        // If making significant forward progress, remember what worked
        if (progress > 0.5) {
            this.successfulMoves.push([...this.movementPatterns]);
            this.stuckCounter = 0;
            
            // Slightly enhance what's working
            for (let pattern of this.movementPatterns) {
                pattern.successRate += 0.1;
                
                // Boost successful movement slightly
                if (pattern.direction.x > 0) {
                    pattern.amplitude *= 1.05;
                    pattern.amplitude = Math.min(pattern.amplitude, 0.005);
                }
            }
        } else if (progress < 0.1) {
            // We might be stuck, increment counter
            this.stuckCounter++;
            
            // If stuck for too long, try something different
            if (this.stuckCounter > 100) {
                this.stuckCounter = 0;
                
                // Randomly change some movement patterns
                for (let pattern of this.movementPatterns) {
                    if (random() < 0.3) {
                        pattern.phase = random(0, TWO_PI);
                        pattern.frequency = random(0.02, 0.2);
                        pattern.direction.x += random(-0.3, 0.3);
                        pattern.direction.y += random(-0.3, 0.3);
                    }
                }
                
                // If we have successful moves from the past, try to mimic them
                if (this.successfulMoves.length > 0) {
                    const goodPattern = random(this.successfulMoves);
                    for (let i = 0; i < this.movementPatterns.length && i < goodPattern.length; i++) {
                        // Blend with a successful pattern
                        if (random() < 0.5) {
                            this.movementPatterns[i].frequency = 
                                0.7 * this.movementPatterns[i].frequency + 
                                0.3 * goodPattern[i].frequency;
                            this.movementPatterns[i].direction = {
                                x: 0.7 * this.movementPatterns[i].direction.x + 
                                   0.3 * goodPattern[i].direction.x,
                                y: 0.7 * this.movementPatterns[i].direction.y + 
                                   0.3 * goodPattern[i].direction.y
                            };
                        }
                    }
                }
            }
        }
        
        this.lastPosition = currentX;
    }
    
    update() {
        this.timeStep += this.simulationSpeed;
        this.evaluateProgress();
        
        // Check for ground contacts
        this.detectGroundContacts();
        
        // Ensure parts remain properly connected
        this.preventPartSeparation();
        
        // Apply forces based on AI behavior
        for (let i = 0; i < this.movementPatterns.length; i++) {
            const pattern = this.movementPatterns[i];
            const bodyPart = pattern.bodyPart;
            
            // Check if this is an appendage
            const isAppendage = this.appendages.some(a => a.shape === bodyPart);
            const appendageInfo = isAppendage ? this.appendages.find(a => a.shape === bodyPart) : null;
            
            // Get body part for mass-based force scaling
            const body = bodyPart.body;
            const mass = body.mass;
            
            // Scale forces extremely inversely with mass - heavier objects move very little
            // Using an extreme scaling factor to keep objects more stable
            const massScaleFactor = 1 / (1 + mass * 50); // Extremely aggressive mass scaling
            
            // Base sine wave movement with mass scaling
            let forceX = sin(this.timeStep * pattern.frequency + pattern.phase) * 
                         pattern.amplitude * pattern.direction.x * massScaleFactor;
            let forceY = cos(this.timeStep * pattern.frequency + pattern.phase) * 
                         pattern.amplitude * pattern.direction.y * massScaleFactor;
            
            // Add walking cycle for appendages
            if (pattern.walkCycle) {
                const walkPhase = this.timeStep * pattern.walkCycle.speed + pattern.walkCycle.phaseOffset;
                
                // Check if appendage is in contact with ground
                const isInContact = bodyPart.body.isInContact;
                const contactPhase = sin(walkPhase);
                
                // Determine if this is in push-off or recovery phase
                const isPushPhase = contactPhase > 0;
                
                // Add stepHeight and pushForce if they exist, otherwise use defaults
                const stepHeight = pattern.walkCycle.stepHeight || 1.0;
                const pushForce = pattern.walkCycle.pushForce || 1.5;
                
                if (isInContact && isPushPhase) {
                    // Push-off force when touching ground - gentler for human-like gait
                    const pushStrength = pattern.walkCycle.strength * 
                                        pattern.amplitude * 
                                        pushForce * 1.5 * massScaleFactor; // Reduced force
                    
                    // Direction depends on which side the appendage is on
                    const directionMultiplier = appendageInfo && appendageInfo.isLeftSide ? -1.0 : 1.0;
                    
                    // Apply horizontal force during push-off with smoother profile
                    // Use a non-linear function to simulate natural push-off mechanics
                    const pushProfile = sin(contactPhase * PI) * 0.8; // Smoother, more gradual push
                    forceX += pushStrength * directionMultiplier * pushProfile;
                    
                    // Gentler upward force to prepare for lift
                    // Human-like walking has minimal vertical movement
                    const liftProfile = pow(contactPhase, 2) * 0.7; // Gentler lift profile
                    forceY -= pushStrength * 0.2 * liftProfile * (1 / (mass * 2));
                    
                    // Add subtle "grip" effect - slight backward force at start of push
                    if (contactPhase < 0.3) {
                        forceX -= pushStrength * directionMultiplier * 0.2 * (0.3 - contactPhase);
                    }
                } else {
                    // Recovery phase - with human-like timing
                    // Human walking has a stance phase (~60%) and swing phase (~40%)
                    const liftStrength = pattern.walkCycle.strength * pattern.amplitude * 
                                         stepHeight * massScaleFactor * 1.2; // Gentler recovery strength
                    
                    // Create a more human-like recovery motion
                    // - More time in stance phase, less in swing phase
                    // - Slower lift, faster return to ground
                    const recoveryProgress = (1 + contactPhase) / 2; // 0 to 1 during recovery
                    
                    // Human-like lift profile - less height, more gradual
                    const liftProfile = sin(recoveryProgress * PI) * 0.6; // Lower, gentler lift
                    const liftHeightFactor = 1 / (1 + mass * 5); // Reduce lift height for heavier parts
                    forceY -= liftStrength * 0.6 * liftProfile * liftHeightFactor;
                    
                    // Forward/backward motion during recovery
                    if (appendageInfo) {
                        // Human walking has a specific pattern of foot movement
                        const recoveryX = appendageInfo.isLeftSide ? 1.0 : -1.0;
                        
                        // First half of recovery: gentle backward movement
                        if (recoveryProgress < 0.4) { // Shorter backward phase
                            const backwardProfile = (0.4 - recoveryProgress) * 2.5; // Gentler backward motion
                            forceX += liftStrength * 0.25 * recoveryX * backwardProfile;
                        } 
                        // Second half: forward movement to prepare for next step
                        else {
                            // Longer forward phase (60% of recovery)
                            const forwardProgress = (recoveryProgress - 0.4) / 0.6; // Normalized 0-1
                            const forwardProfile = sin(forwardProgress * PI/2); // Accelerate, then maintain
                            forceX -= liftStrength * 0.5 * recoveryX * forwardProfile;
                        }
                    }
                }
                
                // Add slight inward force to keep appendages from splaying too far
                if (appendageInfo) {
                    const centeringForce = 0.0002 * pattern.amplitude;
                    const distanceFromBody = bodyPart.body.position.x - this.mainBody.body.position.x;
                    const idealOffset = appendageInfo.isLeftSide ? -50 : 50;
                    const deviation = distanceFromBody - idealOffset;
                    
                    // Apply centering force based on how far from ideal position
                    forceX -= centeringForce * deviation;
                }
                
                // Visual feedback for push-off and recovery phases
                if (this.debugMode && bodyPart.isAnimating) {
                    if (isPushPhase) {
                        // Green for push phase with intensity based on force
                        const intensity = map(abs(contactPhase), 0, 1, 100, 220);
                        bodyPart.animationColor = color(0, intensity, 0, 150);
                    } else {
                        // Blue for recovery phase with intensity based on height
                        const intensity = map(abs(contactPhase), 0, 1, 100, 220);
                        bodyPart.animationColor = color(0, 0, intensity, 150);
                    }
                }
            }
            
            // Add random jitter if specified
            if (pattern.jitter) {
                forceX += random(-pattern.jitter, pattern.jitter);
                forceY += random(-pattern.jitter, pattern.jitter);
            }
            
            // Add extremely minimal forward bias to barely encourage forward movement
            // Apply bias more to appendages than main body
            if (isAppendage) {
                forceX += this.forwardBias * pattern.amplitude * 0.05;
            } else {
                // Even less bias for the main body to keep it stable
                forceX += this.forwardBias * pattern.amplitude * 0.01;
            }
            
            // Apply coordinated movements between appendages
            // If this is an appendage, coordinate with other appendages
            if (isAppendage && this.appendages.length > 1) {
                // Find other appendages on same side
                const sameSideAppendages = this.appendages.filter(a => 
                    a.shape !== bodyPart && a.isLeftSide === appendageInfo.isLeftSide);
                
                // If there are other appendages on same side, coordinate movement
                if (sameSideAppendages.length > 0) {
                    for (const otherAppendage of sameSideAppendages) {
                        // Get phase difference to encourage alternating motion
                        const thisPattern = this.movementPatterns.find(p => p.bodyPart === bodyPart);
                        const otherPattern = this.movementPatterns.find(p => p.bodyPart === otherAppendage.shape);
                        
                        if (thisPattern && otherPattern && thisPattern.walkCycle && otherPattern.walkCycle) {
                            // Calculate how in-phase these appendages are
                            const thisPhase = sin(this.timeStep * thisPattern.walkCycle.speed + thisPattern.walkCycle.phaseOffset);
                            const otherPhase = sin(this.timeStep * otherPattern.walkCycle.speed + otherPattern.walkCycle.phaseOffset);
                            
                            // If moving in the same phase, reduce force to encourage alternating
                            if (thisPhase * otherPhase > 0) {
                                forceX *= 0.8;
                                forceY *= 0.8;
                            }
                        }
                    }
                }
            }
            
            // Apply the calculated force
            const force = { x: forceX, y: forceY };
            bodyPart.applyForce(force);
            
            // Adapt the movement pattern based on progress
            pattern.adaptation.x += random(-this.learningRate, this.learningRate);
            pattern.adaptation.y += random(-this.learningRate, this.learningRate);
            
            // Apply learned adaptations
            pattern.direction.x += pattern.adaptation.x;
            pattern.direction.y += pattern.adaptation.y;
            
            // Constrain adaptations to reasonable values
            pattern.direction.x = constrain(pattern.direction.x, -1.5, 1.5);
            pattern.direction.y = constrain(pattern.direction.y, -1.0, 0.5);
        }
    }
    
    detectGroundContacts() {
        // Get all collisions in the world
        const collisions = Matter.Detector.collisions(Matter.Detector.create({
            bodies: this.bodyParts.map(part => part.body)
        }), world);
        
        // Reset all ground contact flags
        for (const part of this.bodyParts) {
            part.body.isInContact = false;
        }
        
        // Check for contacts with ground
        for (const collision of collisions) {
            const { bodyA, bodyB } = collision;
            
            // Check if either body is the ground
            if (bodyA === ground) {
                // Mark bodyB as in contact
                bodyB.isInContact = true;
                bodyB.parentShape = this.bodyParts.find(part => part.body === bodyB);
                if (bodyB.parentShape) {
                    bodyB.parentShape.isAnimating = true;
                    bodyB.parentShape.lastContactTime = this.timeStep;
                }
            } else if (bodyB === ground) {
                // Mark bodyA as in contact
                bodyA.isInContact = true;
                bodyA.parentShape = this.bodyParts.find(part => part.body === bodyA);
                if (bodyA.parentShape) {
                    bodyA.parentShape.isAnimating = true;
                    bodyA.parentShape.lastContactTime = this.timeStep;
                }
            }
        }
        
        // Update animation state for parts not in contact
        for (const part of this.bodyParts) {
            if (!part.body.isInContact && part.isAnimating) {
                // Keep animation going for a short time after contact ends
                if (part.lastContactTime && this.timeStep - part.lastContactTime > 20) {
                    part.isAnimating = false;
                }
            }
        }
    }
    
    display(updatePhysics = true) {
        // Update AI movement only if updatePhysics is true
        if (updatePhysics) {
            this.update();
        }
        
        // Draw connection lines between appendages and body
        // This ensures visual continuity even if physics has small gaps
        if (this.mainBody && this.appendages.length > 0) {
            push();
            stroke(40, 40, 40, 200);
            strokeWeight(4);
            
            for (const appendageInfo of this.appendages) {
                const appendage = appendageInfo.shape;
                
                if (appendage.connectionPoint) {
                    // Get the original connection points
                    const bodyPoint = appendage.connectionPoint.bodyPoint;
                    const appendagePoint = appendage.connectionPoint.appendagePoint;
                    
                    // Calculate the current world positions of each shape
                    const mainBodyPos = this.mainBody.body.position;
                    const mainBodyAngle = this.mainBody.body.angle;
                    const appendagePos = appendage.body.position;
                    const appendageAngle = appendage.body.angle;
                    
                    // Transform connection points to current world space
                    const bodyLocalPoint = appendage.connectionPoint.bodyLocalPoint;
                    const appendageLocalPoint = appendage.connectionPoint.appendageLocalPoint;
                    
                    // Calculate current body connection point
                    const bodyWorldX = mainBodyPos.x + 
                        (bodyLocalPoint.x * Math.cos(mainBodyAngle) - bodyLocalPoint.y * Math.sin(mainBodyAngle));
                    const bodyWorldY = mainBodyPos.y + 
                        (bodyLocalPoint.x * Math.sin(mainBodyAngle) + bodyLocalPoint.y * Math.cos(mainBodyAngle));
                        
                    // Calculate current appendage connection point
                    const appendageWorldX = appendagePos.x + 
                        (appendageLocalPoint.x * Math.cos(appendageAngle) - appendageLocalPoint.y * Math.sin(appendageAngle));
                    const appendageWorldY = appendagePos.y + 
                        (appendageLocalPoint.x * Math.sin(appendageAngle) + appendageLocalPoint.y * Math.cos(appendageAngle));
                    
                    // Draw solid connection line
                    strokeWeight(6);
                    stroke(40, 40, 40, 220);
                    line(bodyWorldX, bodyWorldY, appendageWorldX, appendageWorldY);
                }
            }
            pop();
        }
        
        // Display body parts
        for (let part of this.bodyParts) {
            part.display();
        }
        
        // Display joints as pivot points
        push();
        for (let joint of this.joints) {
            // Only display the main visible joints
            if (joint.render.visible) {
                const pointA = joint.bodyA.position;
                const offsetA = joint.pointA;
                const pointB = joint.bodyB.position;
                const offsetB = joint.pointB;
                
                // Draw pivot points
                push();
                noStroke();
                fill(255, 100, 0, 200); // Orange pivot indicator
                ellipse(
                    pointA.x + offsetA.x,
                    pointA.y + offsetA.y,
                    8, 8
                );
                
                fill(255, 100, 0, 150); // Orange pivot indicator
                ellipse(
                    pointB.x + offsetB.x,
                    pointB.y + offsetB.y,
                    8, 8
                );
                pop();
            }
        }
        pop();
        
        // Optional debug info - draw connection points in simulation mode
        if (this.debugMode) {
            push();
            textSize(12);
            fill(0);
            text("Pivot points shown in orange", 20, 30);
            
            // Draw body center of mass
            if (this.mainBody) {
                push();
                fill(255, 0, 0, 150);
                noStroke();
                ellipse(this.mainBody.body.position.x, this.mainBody.body.position.y, 12, 12);
                pop();
            }
            pop();
        }
    }
}