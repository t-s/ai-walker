class Shape {
    constructor(points, world, x, y, options = {}) {
        this.points = points;
        this.world = world;
        this.x = x;
        this.y = y;
        this.color = options.color || color(random(100, 200), random(100, 200), random(100, 200), 200);
        
        // Create Matter.js body from points
        this.createBody();
    }
    
    createBody() {
        // Convert points to Matter.js vertices format
        const vertices = this.points.map(p => ({
            x: p.x - this.points[0].x + this.x,
            y: p.y - this.points[0].y + this.y
        }));
        
        // Create Matter.js body
        this.body = Matter.Bodies.fromVertices(this.x, this.y, [vertices], {
            friction: 0.5,
            restitution: 0.2,
            density: 0.01,
            // Allow for custom properties from options
            ...this.options
        });
        
        // Add to world
        Matter.Composite.add(this.world, this.body);
    }
    
    display() {
        const pos = this.body.position;
        const angle = this.body.angle;
        
        push();
        translate(pos.x, pos.y);
        rotate(angle);
        
        fill(this.color);
        stroke(0);
        strokeWeight(2);
        
        // Draw the shape
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