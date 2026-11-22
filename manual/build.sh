#!/bin/sh
# Genera index.html (GitHub Pages) a partir de cuerpo.html
cd "$(dirname "$0")"
{ printf '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<meta name="theme-color" content="#1F7A55">\n<link rel="icon" href="../icon-192.png">\n</head>\n<body>\n'; cat cuerpo.html; printf '\n</body>\n</html>\n'; } > index.html
