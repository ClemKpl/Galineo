$message = Read-Host "Commentaire du commit"

if ([string]::IsNullOrWhiteSpace($message)) {
    Write-Host "Annule : commentaire vide." -ForegroundColor Red
    exit 1
}

git add .
git commit -m $message
git push

Write-Host "`nPushe avec succes !" -ForegroundColor Green
