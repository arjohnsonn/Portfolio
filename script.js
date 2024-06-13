var canvas = document.getElementById("canvas"),
  ctx = canvas.getContext("2d");

const starSpeed = 65;
var stars = [], // Array that contains the stars
  FPS = 144, // Frames per second
  x = 230, // Number of stars
  mouse = {
    x: 0,
    y: 0,
  }; // mouse location

// Increase canvas resolution and scale context
function initCanvas() {
  canvas.width = window.innerWidth * 3;
  canvas.height = window.innerHeight * 3;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.scale(3, 3);

  stars = [];

  // Push stars to array
  for (var i = 0; i < x; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1 + 1,
      vx: Math.floor(Math.random() * starSpeed),
      vy: Math.floor(Math.random() * starSpeed),
    });
  }
}

const typewriterText = document.getElementById("typewriter-text");

function updateText() {
  // handle landing page text resizing
  if (window.innerWidth < 750) {
    typewriterText.style.fontSize = "3.5vw";
  } else {
    typewriterText.style.fontSize = "2vw";
  }
}

initCanvas();
updateText();
addEventListener("resize", () => {
  initCanvas();
  updateText();
});

// Draw the scene
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw stars
  ctx.globalCompositeOperation = "source-over";
  for (var i = 0, x = stars.length; i < x; i++) {
    var s = stars[i];
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(s.x / 3, s.y / 3, s.radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "black";
    ctx.stroke();
  }

  ctx.beginPath();
  for (var i = 0, x = stars.length; i < x; i++) {
    var starI = stars[i];
    ctx.moveTo(starI.x / 3, starI.y / 3);
    if (distance(mouse, starI) < 350) ctx.lineTo(mouse.x / 3, mouse.y / 3);
    for (var j = 0, x = stars.length; j < x; j++) {
      var starII = stars[j];
      if (distance(starI, starII) < 150) {
        ctx.lineTo(starII.x / 3, starII.y / 3);
      }
    }
  }
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = "gray";
  ctx.stroke();

  // Create vignette effect around mouse
  var gradient = ctx.createRadialGradient(
    mouse.x / 3,
    mouse.y / 3,
    50,
    mouse.x / 3,
    mouse.y / 3,
    350
  );
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 1)");

  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width / 3, canvas.height / 3);
}

function distance(point1, point2) {
  var xs = 0;
  var ys = 0;

  xs = point2.x - point1.x;
  xs = xs * xs;

  ys = point2.y - point1.y;
  ys = ys * ys;

  return Math.sqrt(xs + ys);
}

// Update star locations
function update() {
  for (var i = 0, x = stars.length; i < x; i++) {
    var s = stars[i];
    s.x += s.vx / FPS;
    s.y += s.vy / FPS;

    if (s.x < 0 || s.x > canvas.width) s.vx = -s.vx;
    if (s.y < 0 || s.y > canvas.height) s.vy = -s.vy;
  }
}

canvas.addEventListener("mousemove", function (e) {
  mouse.x = e.clientX * 3;
  mouse.y = e.clientY * 3;
});

// Update and draw
function tick() {
  draw();
  update();
  requestAnimationFrame(tick);
}

tick();
