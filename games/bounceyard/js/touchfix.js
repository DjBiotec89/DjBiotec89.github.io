// Pointer-Events-Polyfill braucht touch-action-Attribute auf den Spielflächen
(function () { var c = document.querySelectorAll('canvas'); for (var i = 0; i < c.length; i++) c[i].setAttribute('touch-action', 'none'); })();
