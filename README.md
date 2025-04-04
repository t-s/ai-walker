# AI Walker

A web application that allows users to draw shapes and simulates how they would move/ambulate using simple AI behavior.

## Features

- Draw custom shapes using p5.js
- Physics-based simulation using Matter.js
- Simple AI-driven movement that adapts to the shapes you draw

## How to Use

1. Open `index.html` in a web browser
2. Draw shapes on the canvas by clicking and dragging
3. Click "Simulate" to see how your shapes would move
4. Click "Clear" to reset and start over

## Technologies Used

- p5.js for drawing and rendering
- Matter.js for physics simulation
- JavaScript for AI behaviors

## Running the Project

Simply open `index.html` in a web browser. No server required.

Alternatively, you can serve the project using a basic HTTP server:

```bash
# Using Python
python -m http.server

# Using Node.js
npx serve
```

Then open `http://localhost:8000` (or the port indicated) in your browser.