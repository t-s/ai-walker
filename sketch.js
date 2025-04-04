let canvas;
let currentShape = [];
let shapes = [];
let isDrawing = false;
let drawingMode = true;
let simulationStarted = false;
let walker;

// Matter.js variables
let engine;
let world;
let ground;

function setup() {
    canvas = createCanvas(800, 400); // Reduced height further to match container
    canvas.parent('canvas-container');
    
    // Disable default touch behavior on canvas to prevent scrolling
    canvas.elt.addEventListener('touchstart', function(e) {
        e.preventDefault();
    }, { passive: false });
    
    canvas.elt.addEventListener('touchmove', function(e) {
        e.preventDefault();
    }, { passive: false });
    
    canvas.elt.addEventListener('touchend', function(e) {
        e.preventDefault();
    }, { passive: false });
    
    // Initialize Matter.js physics engine
    engine = Matter.Engine.create();
    world = engine.world;
    world.gravity.y = 0.3; // Very low gravity for extremely slow movement
    
    // Create ground
    ground = Matter.Bodies.rectangle(width/2, height, width, 50, {
        isStatic: true,
        render: { fillStyle: '#222222' },
        friction: 0.8,  // High friction for better push-off
        restitution: 0.2  // Some bounciness
    });
    Matter.Composite.add(world, ground);
    
    // UI setup with mobile-friendly handling
    const clearBtn = document.getElementById('clear-btn');
    const simulateBtn = document.getElementById('simulate-btn');
    
    // Add both click and touchend events for better mobile support
    clearBtn.addEventListener('click', clearCanvas);
    clearBtn.addEventListener('touchend', function(e) {
        e.preventDefault();
        clearCanvas();
    });
    
    simulateBtn.addEventListener('click', startSimulation);
    simulateBtn.addEventListener('touchend', function(e) {
        e.preventDefault();
        startSimulation();
    });
    
    // Add instructions
    let instructions = createP('Draw a body, then limbs. Click "Simulate" to see it move.');
    instructions.parent('controls');
    instructions.style('margin-top', '5px');
    instructions.style('font-style', 'italic');
    instructions.style('font-size', '14px');
    
    background(255);
}

function draw() {
    background(255);
    
    // Always draw the ground first before anything else
    if (!drawingMode) {
        // Draw ground consistently every frame
        drawGround();
    }
    
    // Slow down the physics engine by limiting updates
    // Only update physics every 3 frames for even slower movement
    if (!drawingMode && frameCount % 3 !== 0) {
        // Skip physics update this frame but still render walker
        if (walker) {
            walker.display(false); // Pass false to skip physics update
        }
        return;
    }
    
    if (drawingMode) {
        // Drawing mode
        // Draw current shape in progress
        if (currentShape.length > 0) {
            stroke(0);
            strokeWeight(2);
            noFill();
            beginShape();
            for (let point of currentShape) {
                vertex(point.x, point.y);
            }
            if (isDrawing) {
                // Use touches array for touch devices, otherwise use mouse position
                const inputX = touches.length > 0 ? touches[0].x : mouseX;
                const inputY = touches.length > 0 ? touches[0].y : mouseY;
                vertex(inputX, inputY);
            }
            endShape(isDrawing ? OPEN : CLOSE);
        }
        
        // Draw existing shapes with different colors and connection points
        for (let i = 0; i < shapes.length; i++) {
            const shape = shapes[i];
            
            // Use different colors for first shape (likely body) vs appendages
            if (i === 0) {
                stroke(0);
                strokeWeight(2);
                fill(200, 200, 255, 150); // Body color - bluish
            } else {
                stroke(0);
                strokeWeight(2);
                fill(200, 255, 200, 150); // Appendage color - greenish
                
                // If we have a previous shape, draw a connection hint
                if (shapes.length > 1) {
                    // Find the closest point between this shape and first shape (body)
                    let closestDistance = Infinity;
                    let closestPoint1 = null;
                    let closestPoint2 = null;
                    
                    for (const p1 of shapes[0]) { // First shape (body)
                        for (const p2 of shape) { // Current shape (appendage)
                            const d = dist(p1.x, p1.y, p2.x, p2.y);
                            if (d < closestDistance) {
                                closestDistance = d;
                                closestPoint1 = p1;
                                closestPoint2 = p2;
                            }
                        }
                    }
                    
                    // Draw connection point indicators
                    if (closestPoint1 && closestPoint2) {
                        push();
                        strokeWeight(3);
                        stroke(255, 0, 0); // Red for connection points
                        point(closestPoint1.x, closestPoint1.y);
                        point(closestPoint2.x, closestPoint2.y);
                        
                        // Draw a dashed line between connection points
                        drawDashedLine(closestPoint1.x, closestPoint1.y, 
                                       closestPoint2.x, closestPoint2.y, 
                                       5, 3);
                        pop();
                    }
                }
            }
            
            // Draw the shape
            beginShape();
            for (let point of shape) {
                vertex(point.x, point.y);
            }
            endShape(CLOSE);
        }
        
        // Show connection point hint text if multiple shapes
        if (shapes.length > 0 && currentShape.length > 0) {
            push();
            fill(80);
            noStroke();
            textAlign(CENTER);
            textSize(14);
            text("Appendages will be connected at nearest points", width/2, 30);
            pop();
        }
    } else {
        // Simulation mode
        // Run the physics engine at extremely slow speed
        Matter.Engine.update(engine, 1000/120); // Force very small time step
        
        // Draw walker with physics update
        if (walker) {
            walker.display(true); // Update physics
        }
    }
}

// Function to draw the ground consistently
function drawGround() {
    fill(50);
    noStroke();
    rectMode(CENTER);
    rect(width/2, height, width, 50);
}

// Helper function to draw a dashed line
function drawDashedLine(x1, y1, x2, y2, dashLength, gapLength) {
    const distance = dist(x1, y1, x2, y2);
    const dashCount = Math.floor(distance / (dashLength + gapLength));
    const dashVector = {
        x: ((x2 - x1) / distance) * (dashLength + gapLength),
        y: ((y2 - y1) / distance) * (dashLength + gapLength)
    };
    
    push();
    stroke(255, 0, 0, 150);
    strokeWeight(2);
    
    for (let i = 0; i < dashCount; i++) {
        const startX = x1 + (dashVector.x * i);
        const startY = y1 + (dashVector.y * i);
        const endX = startX + (dashVector.x * (dashLength / (dashLength + gapLength)));
        const endY = startY + (dashVector.y * (dashLength / (dashLength + gapLength)));
        
        line(startX, startY, endX, endY);
    }
    pop();
}

function mousePressed() {
    if (drawingMode) {
        // Get the current position (touch or mouse)
        const inputX = touches.length > 0 ? touches[0].x : mouseX;
        const inputY = touches.length > 0 ? touches[0].y : mouseY;
        
        if (inputX > 0 && inputX < width && inputY > 0 && inputY < height) {
            isDrawing = true;
            currentShape = [{x: inputX, y: inputY}];
        }
        return false; // Prevent default behavior
    }
}

// For touch devices
function touchStarted() {
    // Use the same logic as mousePressed
    return mousePressed();
}

function touchMoved() {
    // Use the same logic as mouseDragged
    return mouseDragged();
}

function touchEnded() {
    // Use the same logic as mouseReleased
    return mouseReleased();
}

function mouseDragged() {
    if (isDrawing && drawingMode) {
        // Get the current position (touch or mouse)
        const inputX = touches.length > 0 ? touches[0].x : mouseX;
        const inputY = touches.length > 0 ? touches[0].y : mouseY;
        
        // Only add points if they're within the canvas
        if (inputX > 0 && inputX < width && inputY > 0 && inputY < height) {
            // Add points with a minimum distance to avoid too many points
            const lastPoint = currentShape[currentShape.length - 1];
            const d = dist(lastPoint.x, lastPoint.y, inputX, inputY);
            if (d > 10) {
                currentShape.push({x: inputX, y: inputY});
            }
        }
        return false; // Prevent default behavior
    }
}

function mouseReleased() {
    if (isDrawing && drawingMode) {
        isDrawing = false;
        
        // Only add shapes with at least 3 points
        if (currentShape.length >= 3) {
            // Simplify shape if too complex
            if (currentShape.length > 20) {
                currentShape = simplifyShape(currentShape, 20);
            }
            
            shapes.push(currentShape);
            currentShape = [];
        }
        return false; // Prevent default behavior
    }
}

function simplifyShape(shape, targetCount) {
    if (shape.length <= targetCount) return shape;
    
    const step = Math.ceil(shape.length / targetCount);
    const simplified = [];
    
    for (let i = 0; i < shape.length; i += step) {
        simplified.push(shape[i]);
    }
    
    // Always include the last point
    if (simplified[simplified.length - 1] !== shape[shape.length - 1]) {
        simplified.push(shape[shape.length - 1]);
    }
    
    return simplified;
}

function clearCanvas() {
    shapes = [];
    currentShape = [];
    
    if (!drawingMode) {
        // Reset simulation
        drawingMode = true;
        simulationStarted = false;
        
        // Clear physics world
        Matter.World.clear(world);
        Matter.Engine.clear(engine);
        
        // Recreate ground
        ground = Matter.Bodies.rectangle(width/2, height, width, 50, {
            isStatic: true,
            render: { fillStyle: '#222222' }
        });
        Matter.Composite.add(world, ground);
    }
    
    // Force a redraw
    redraw();
}

function startSimulation() {
    console.log("Starting simulation, shapes:", shapes.length, "drawingMode:", drawingMode);
    
    if (shapes.length > 0 && drawingMode) {
        drawingMode = false;
        simulationStarted = true;
        
        // Create walker from the drawn shapes
        walker = new Walker(shapes, world);
        
        // Force a redraw
        redraw();
    }
}

// Make functions available globally for direct access from HTML
window.clearCanvas = clearCanvas;
window.startSimulation = startSimulation;