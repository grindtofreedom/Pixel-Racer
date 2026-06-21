'use strict';

/**
 * Entry point. Wires the canvas to the viewport, collects the DOM overlay
 * elements, constructs the Game and kicks off the loop.
 */
(function bootstrap() {
  const canvas = document.getElementById('game');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (window.GAME) {
      // Cameras are re-sized per viewport every frame; just snap them so the
      // first frame after a resize is correct.
      window.GAME.camera1.resize(canvas.width, canvas.height);
      window.GAME.camera2.resize(canvas.width, canvas.height);
    }
  }
  window.addEventListener('resize', resize);
  resize();

  const dom = {
    menu: document.getElementById('menu'),
    finish: document.getElementById('finish'),
    results: document.getElementById('results'),
    onePlayerBtn: document.getElementById('onePlayerBtn'),
    twoPlayerBtn: document.getElementById('twoPlayerBtn'),
    restartBtn: document.getElementById('restartBtn'),
    menuBtn: document.getElementById('menuBtn'),
    tgSendBtn: document.getElementById('tgSendBtn'),
    title: document.getElementById('finishTitle'),
  };

  const game = new Game(canvas, dom);
  window.GAME = game; // exposed for the resize handler / debugging
  game.start();
})();
