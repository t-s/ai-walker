class Walker {
    constructor(shapes, world) {
        this.world = world;
        this.bodyParts = [];
        this.joints = [];
        this.timeStep = 0;
        this.simulationSpeed = 0.05;
        this.learningRate = 0.0005; // Rate at which the AI "learns" movement patterns
        this.forwardBias = 0.6; // Bias toward moving forward (right)
        this.successfulMoves = [];
        this.lastPosition = null;
        this.stuckCounter = 0;
        this.appendages = [];
        this.mainBody = null;
        
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
            this.mainBody = new Shape(mainBodyShape, this.world, width / 2, baseY, {
                friction: 0.7,
                restitution: 0.2,
                density: 0.01, // Heavier to act as the main body
                frictionAir: 0.01
            });
            
            this.bodyParts.push(this.mainBody);
            
            // Create appendages from the remaining shapes
            let appendageIndex = 0;
            for (let i = 0; i < shapes.length; i++) {
                if (i !== largestShapeIndex) {
                    const isLeftSide = appendageIndex % 2 === 0;
                    const shape = shapes[i];
                    
                    // Position appendages around the main body
                    const offset = 30 + (Math.floor(appendageIndex / 2) * 50);
                    const angleOffset = (appendageIndex / shapes.length) * PI;
                    const xOffset = isLeftSide ? -offset : offset;
                    
                    const appendage = new Shape(shape, this.world, 
                        width / 2 + xOffset, 
                        baseY - 20 - (appendageIndex * 5), 
                        {
                            friction: 0.3,
                            restitution: 0.4,
                            density: 0.003, // Lighter for appendages
                            frictionAir: 0.02
                        });
                    
                    this.bodyParts.push(appendage);
                    this.appendages.push({
                        shape: appendage,
                        isLeftSide: isLeftSide,
                        index: appendageIndex
                    });
                    
                    // Create joint connecting to main body
                    const joint = Matter.Constraint.create({
                        bodyA: this.mainBody.body,
                        bodyB: appendage.body,
                        pointA: { x: xOffset / 2, y: 0 },
                        pointB: { x: -xOffset / 4 * (isLeftSide ? -1 : 1), y: 0 },
                        stiffness: 0.1,
                        length: offset / 2,
                        damping: 0.2,
                        render: { visible: true }
                    });
                    
                    Matter.Composite.add(this.world, joint);
                    this.joints.push(joint);
                    
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
        
        // Movement patterns for appendages
        for (let i = 0; i < this.appendages.length; i++) {
            const appendage = this.appendages[i];
            const isLeft = appendage.isLeftSide;
            
            // Create more extreme movement for appendages
            const pattern = {
                bodyPart: appendage.shape,
                frequency: random(0.05, 0.15),  // Faster movement
                amplitude: random(0.001, 0.004),  // Stronger movement
                phase: random(0, TWO_PI) + (isLeft ? PI : 0),  // Offset phases based on side
                direction: { 
                    x: random(-0.2, 1.0) * (isLeft ? -1 : 1), // Direction based on side
                    y: random(-0.8, 0.2)  // Mostly upward force to simulate pushing
                },
                adaptation: { x: 0, y: 0 },
                successRate: 0,
                // Add randomized "walking" behavior
                walkCycle: {
                    speed: random(0.08, 0.2),
                    strength: random(0.5, 1.5),
                    phaseOffset: i * (PI / this.appendages.length)
                }
            };
            
            this.movementPatterns.push(pattern);
        }
        
        // Additional random movement variations
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
        
        // Apply forces based on AI behavior
        for (let i = 0; i < this.movementPatterns.length; i++) {
            const pattern = this.movementPatterns[i];
            const bodyPart = pattern.bodyPart;
            
            // Base sine wave movement
            let forceX = sin(this.timeStep * pattern.frequency + pattern.phase) * 
                         pattern.amplitude * pattern.direction.x;
            let forceY = cos(this.timeStep * pattern.frequency + pattern.phase) * 
                         pattern.amplitude * pattern.direction.y;
            
            // Add walking cycle for appendages
            if (pattern.walkCycle) {
                const walkPhase = this.timeStep * pattern.walkCycle.speed + pattern.walkCycle.phaseOffset;
                
                // Create a more complex walking pattern
                // - Forward push during "down" phase
                // - Lift during "up" phase
                if (sin(walkPhase) > 0) {
                    // Down stroke - push harder
                    forceX += pattern.walkCycle.strength * pattern.amplitude * 
                             (pattern.bodyPart === this.appendages ? (pattern.isLeftSide ? -0.5 : 0.5) : 0.3) * 
                             abs(sin(walkPhase));
                    forceY += pattern.walkCycle.strength * pattern.amplitude * 0.2;
                } else {
                    // Up stroke - lift
                    forceY -= pattern.walkCycle.strength * pattern.amplitude * 0.3 * abs(sin(walkPhase));
                }
            }
            
            // Add random jitter if specified
            if (pattern.jitter) {
                forceX += random(-pattern.jitter, pattern.jitter);
                forceY += random(-pattern.jitter, pattern.jitter);
            }
            
            // Add forward bias to encourage moving right
            forceX += this.forwardBias * pattern.amplitude * 0.1;
            
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
    
    display() {
        // Update AI movement
        this.update();
        
        // Display body parts
        for (let part of this.bodyParts) {
            part.display();
        }
        
        // Display joints
        stroke(0);
        strokeWeight(2);
        for (let joint of this.joints) {
            const pointA = joint.bodyA.position;
            const offsetA = joint.pointA;
            const pointB = joint.bodyB.position;
            const offsetB = joint.pointB;
            
            line(
                pointA.x + offsetA.x,
                pointA.y + offsetA.y,
                pointB.x + offsetB.x,
                pointB.y + offsetB.y
            );
        }
    }
}