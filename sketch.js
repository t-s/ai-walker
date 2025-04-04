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
    canvas = createCanvas(800, 600);
    canvas.parent('canvas-container');
    
    // Initialize Matter.js physics engine
    engine = Matter.Engine.create();
    world = engine.world;
    world.gravity.y = 1;
    
    // Create ground
    ground = Matter.Bodies.rectangle(width/2, height, width, 50, {
        isStatic: true,
        render: { fillStyle: '#222222' }
    });
    Matter.Composite.add(world, ground);
    
    // UI setup
    document.getElementById('clear-btn').addEventListener('click', clearCanvas);
    document.getElementById('simulate-btn').addEventListener('click', startSimulation);
    
    // Add instructions
    let instructions = createP('Draw multiple shapes: First draw a body, then draw limbs/appendages. Then click "Simulate" to see how it moves.');
    instructions.parent('controls');
    instructions.style('margin-top', '20px');
    instructions.style('font-style', 'italic');
    
    background(255);
}

function draw() {
    background(255);
    
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
                vertex(mouseX, mouseY);
            }
            endShape(isDrawing ? OPEN : CLOSE);
        }
        
        // Draw existing shapes
        for (let shape of shapes) {
            stroke(0);
            strokeWeight(2);
            fill(200, 200, 255, 100);
            beginShape();
            for (let point of shape) {
                vertex(point.x, point.y);
            }
            endShape(CLOSE);
        }
    } else {
        // Simulation mode
        Matter.Engine.update(engine);
        
        // Draw ground
        fill(50);
        noStroke();
        rectMode(CENTER);
        rect(width/2, height, width, 50);
        
        // Draw walker
        if (walker) {
            walker.display();
        }
    }
}

function mousePressed() {
    if (drawingMode && mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
        isDrawing = true;
        currentShape = [{x: mouseX, y: mouseY}];
    }
}

function mouseDragged() {
    if (isDrawing && drawingMode && mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
        // Add points with a minimum distance to avoid too many points
        const lastPoint = currentShape[currentShape.length - 1];
        const d = dist(lastPoint.x, lastPoint.y, mouseX, mouseY);
        if (d > 10) {
            currentShape.push({x: mouseX, y: mouseY});
        }
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
}

function startSimulation() {
    if (shapes.length > 0 && drawingMode) {
        drawingMode = false;
        simulationStarted = true;
        
        // Create walker from the drawn shapes
        walker = new Walker(shapes, world);
    }
}