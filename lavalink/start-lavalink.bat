@echo off
REM Inicia o Lavalink forcando IPv4.
REM Sua maquina tem IPv6 parcial/quebrado: sem isso os streams de audio falham
REM (SoundCloud da 404, YouTube fica mudo) porque a JVM tenta conectar via IPv6.
cd /d "%~dp0"
set "_JAVA_OPTIONS=-Djava.net.preferIPv4Stack=true"
echo Iniciando Lavalink (IPv4 forcado)...
java -jar Lavalink.jar
echo.
echo Lavalink encerrou. Pressione uma tecla para fechar.
pause >nul
