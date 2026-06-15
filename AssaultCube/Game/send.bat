@echo off
setlocal enabledelayedexpansion

:: =======================================
:: CONFIGURATION
:: =======================================
set "SERVER=mahmoudehabmoheb.servegame.com"
set "PORT=50001"
set "USER=sftp_guest"
set "PASSWORD=Mahmoud123"

set "DATA_DIR=data"
set "FILES_LIST=events matches players telemetry"
set "EXT=.csv"
:: =======================================

:: 1. Verify psftp.exe is present
if not exist "psftp.exe" (
    echo [!] ERROR: psftp.exe is missing from this folder.
    echo Please ensure psftp.exe is placed right next to this batch file.
    pause
    exit /b
)

:: 2. Get current Date and Time (YYYYMMDD_HHMMSS)
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set "dt=%%I"
set "timestamp=%dt:~0,8%_%dt:~8,6%"
set "client_user=%USERNAME%"

:: 3. Initialize the SFTP command file script (psftp format)
(
    echo cd "Training Data"
) > sftp_cmds.txt

:: 4. Loop through files inside the 'data' folder to stage copies
set "uploaded_any=0"
for %%F in (%FILES_LIST%) do (
    if exist "%DATA_DIR%\%%F%EXT%" (
        set "uploaded_any=1"
        set "unique_name=%%F_%client_user%_%timestamp%%EXT%"
        
        :: Staging the unique file copy
        copy "%DATA_DIR%\%%F%EXT%" "!unique_name!" >nul
        echo put "!unique_name!" >> sftp_cmds.txt
    )
)
echo quit >> sftp_cmds.txt

if "%uploaded_any%"=="0" (
    echo Error: No data files found inside the "%DATA_DIR%" folder.
    del sftp_cmds.txt
    pause
    exit /b
)

:: 5. Execute the secure transfer passing the password automatically
echo Uploading data securely... Please wait...
psftp -P %PORT% -l %USER% -pw %PASSWORD% -b sftp_cmds.txt %SERVER%

:: =======================================
:: FAIL-SAFE CHECK
:: =======================================
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] ERROR: SFTP Upload failed. Connection or credentials rejected.
    echo [!] Your original files have NOT been deleted. They are safe inside \%DATA_DIR%\
    echo.
    :: Wipe only temporary staged copies
    for %%F in (%FILES_LIST%) do (
        if exist "%%F_%client_user%_%timestamp%%EXT%" (
            del "%%F_%client_user%_%timestamp%%EXT%"
        )
    )
    del sftp_cmds.txt
    pause
    exit /b
)

:: =======================================
:: CLEANUP PHASE (Only runs if %ERRORLEVEL% is 0)
:: =======================================
echo Upload finished successfully! Cleaning up local workspace...

for %%F in (%FILES_LIST%) do (
    if exist "%%F_%client_user%_%timestamp%%EXT%" (
        del "%%F_%client_user%_%timestamp%%EXT%"
    )
)
del sftp_cmds.txt

for %%F in (%FILES_LIST%) do (
    if exist "%DATA_DIR%\%%F%EXT%" (
        del "%DATA_DIR%\%%F%EXT%"
        echo Deleted local copy: %DATA_DIR%\%%F%EXT%
    )
)

echo Folder cleared cleanly. Done!
pause