' 数据运维工作台 - 启动器
' 双击此文件启动服务并自动打开浏览器
' 无需 Python，无需额外依赖

Set WshShell = CreateObject("WScript.Shell")
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath
WshShell.Run "cmd /c """ & strPath & "\start.bat""", 1, False
