class Shape {
    constructor(points, world, x, y, options = {}) {
        this.points = points;
        this.world = world;
        this.x = x;
        this.y = y;
        this.color = options.color || color(random(100, 200), random(100, 200), random(100, 200), 200);
        this.isAnimating = false; // For animation and ground contact visualization
        this.lastContactTime = 0; // When this shape last touched ground
        this.animationColor = null; // For visual feedback during animation
        this.originalColor = this.color; // Store original color
        this.connectionPoint = null; // Will store connection info if this is an appendage
        
        // Create Matter.js body from points
        this.createBody();
    }
    
    createBody() {
        // Convert points to Matter.js vertices format
        const vertices = this.points.map(p => ({
            x: p.x - this.points[0].x + this.x,
            y: p.y - this.points[0].y + this.y
        }));
        
        // Calculate center of mass for the shape
        let cx = 0, cy = 0;
        for (const p of vertices) {
            cx += p.x;
            cy += p.y;
        }
        cx /= vertices.length;
        cy /= vertices.length;
        
        // Create Matter.js body with specified options
        this.body = Matter.Bodies.fromVertices(this.x, this.y, [vertices], {
            friction: 0.5,
            restitution: 0.2,
            density: 0.01,
            frictionStatic: 0.7,
            collisionFilter: {
                group: 0,
                category: 0x0001,
                mask: 0xFFFFFFFF
            },
            // Allow for custom properties from options
            ...this.options
        });
        
        // Store original positions for each vertex relative to center
        this.originalVertices = vertices.map(v => ({
            x: v.x - cx,
            y: v.y - cy
        }));
        
        // Add to world
        Matter.Composite.add(this.world, this.body);
    }
    
    display() {
        const pos = this.body.position;
        const angle = this.body.angle;
        
        push();
        translate(pos.x, pos.y);
        rotate(angle);
        
        // Determine fill color based on animation state
        if (this.isAnimating && this.animationColor) {
            fill(this.animationColor);
        } else if (this.body.isInContact) {
            // Highlight when in contact with ground
            fill(color(255, 150, 0, 200)); // Orange for ground contact
        } else {
            fill(this.color);
        }
        
        stroke(0);
        strokeWeight(2);
        
        // Draw using the original points since the physics vertices might cause issues
        beginShape();
        for (let point of this.points) {
            // Adjust for center position
            const adjustedX = point.x - this.points[0].x;
            const adjustedY = point.y - this.points[0].y;
            vertex(adjustedX, adjustedY);
        }
        endShape(CLOSE);
        
        // Draw a small indicator for movement direction
        stroke(255, 0, 0);
        strokeWeight(1);
        const velocity = this.body.velocity;
        const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
        
        if (speed > 0.2) {
            const dirX = velocity.x / speed * 15;
            const dirY = velocity.y / speed * 15;
            line(0, 0, dirX, dirY);
            // Arrow head
            push();
            translate(dirX, dirY);
            rotate(atan2(dirY, dirX));
            line(0, 0, -5, -3);
            line(0, 0, -5, 3);
            pop();
        }
        
        // Draw ground contact indicator if in contact with ground
        if (this.body.isInContact) {
            stroke(0, 255, 0);
            strokeWeight(3);
            // Draw a green line at the bottom of the shape to show contact point
            line(-15, 15, 15, 15);
            
            // Add push-off visualization
            fill(0, 255, 0, 100);
            noStroke();
            ellipse(0, 15, 20, 10);
        }
        
        pop();
    }
    
    applyForce(force) {
        Matter.Body.applyForce(this.body, this.body.position, force);
    }
    
    // Remove from physics world
    remove() {
        Matter.Composite.remove(this.world, this.body);
    }
}