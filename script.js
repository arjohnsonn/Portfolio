// Reverted back to non-arrow functions because it would break IE11 completely.

var observer = new IntersectionObserver(
  function (entries) {
    entries.forEach(function (entry) {
      var el = entry.target;
      if (entry.isIntersecting) {
        el.classList.add("animate");
        return;
      }
    });
  },
  { threshold: 0.2 }
);

document.querySelectorAll(".animation").forEach(function (i) {
  if (i) {
    observer.observe(i);
  }
});
