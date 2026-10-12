@echo off
REM ดับเบิลคลิกไฟล์นี้เพื่อเปิดเซิร์ฟเวอร์ + เปิดหน้าเว็บอัตโนมัติ
cd /d "%~dp0"

set "PYTHON=py"
if exist ".venv\Scripts\python.exe" set "PYTHON=.venv\Scripts\python.exe"

"%PYTHON%" run.py %*

echo.
echo เซิร์ฟเวอร์หยุดทํางานแล้ว
pause
