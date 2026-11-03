@echo off
chcp 65001 >nul
setlocal
 title Poker House - Instalador
 color 0A
 echo ================================================
 echo             POKER HOUSE - INSTALADOR
 echo ================================================
 echo.
 where node >nul 2>nul
 if errorlevel 1 (
   echo ERRO: Node.js nao foi encontrado neste computador.
   echo Instale a versao LTS em https://nodejs.org/ e execute este arquivo novamente.
   echo.
   pause
   exit /b 1
 )
 where npm >nul 2>nul
 if errorlevel 1 (
   echo ERRO: npm nao foi encontrado. Reinstale o Node.js LTS.
   pause
   exit /b 1
 )
 echo Node instalado:
 node -v
 echo npm instalado:
 npm -v
 echo.
 echo [1/2] Instalando dependencias. Isso pode levar alguns minutos...
 call npm install --no-audit --no-fund
 if errorlevel 1 (
   echo.
   echo FALHA ao instalar dependencias. Verifique a internet e tente novamente.
   pause
   exit /b 1
 )
 echo.
 echo [2/2] Gerando cliente do banco Prisma...
 call npm run db:generate
 if errorlevel 1 (
   echo.
   echo Dependencias instaladas, mas a geracao do Prisma falhou.
   pause
   exit /b 1
 )
 echo.
 echo ================================================
 echo INSTALACAO DAS DEPENDENCIAS CONCLUIDA!
 echo ================================================
 echo.
 echo ATENCAO: para iniciar o sistema ainda sera necessario configurar
 echo o banco PostgreSQL e o arquivo .env conforme o README.md.
 echo Este instalador nao cria contas, nao publica o site e nao gera APK.
 echo A economia continua sendo exclusivamente virtual/ficticia.
 echo.
 pause
