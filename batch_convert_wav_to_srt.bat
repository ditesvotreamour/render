@echo off
rem Batch script to convert all .wav files in a folder (and subfolders) to .srt using Whisper.

setlocal enabledelayedexpansion

rem ==== Configuration ====
rem Path to Python interpreter (adjust if using a virtual env)
set PYTHON=python
rem Path to the conversion script (same folder as this .bat)
set SCRIPT=%~dp0wav_to_srt.py
rem Whisper model (tiny, base, small, medium, large)
set MODEL=small
rem ==== End config ====

rem Find all .wav files recursively
for /r %%F in (*.wav) do (
    echo Converting "%%F" …
    %PYTHON% "%SCRIPT%" "%%F" -m %MODEL%
)

echo All done.
pause
