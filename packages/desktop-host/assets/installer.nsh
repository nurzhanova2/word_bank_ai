!macro customInstall
  nsExec::ExecToLog 'taskkill /F /T /IM "Bank AI for Word.exe"'
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Office\16.0\Wef\Developer" "f5212ec9-4a1a-4ca7-a195-6fbcd8f7822e"
!macroend
