# Régénération du package-lock.json

## Problème
Le `package-lock.json` du client n'est pas synchronisé avec `package.json`, ce qui cause une erreur lors du build sur Railway.

## Solution

### Option 1 : Régénérer localement (Recommandé)

1. Ouvrez un terminal dans le dossier `client`
2. Exécutez :
   ```bash
   cd client
   npm install
   ```
3. Commitez le nouveau `package-lock.json` :
   ```bash
   git add client/package-lock.json
   git commit -m "Regenerate package-lock.json"
   git push
   ```

### Option 2 : Laisser Railway le régénérer

J'ai créé un fichier `client/nixpacks.toml` qui force Railway à utiliser `npm install` au lieu de `npm ci`. Cela devrait résoudre le problème.

## Fichiers créés

- `client/nixpacks.toml` : Configuration Railway pour utiliser `npm install`
- `fix-package-lock.bat` : Script Windows pour régénérer le lock file

## Après régénération

Une fois le `package-lock.json` régénéré, Railway devrait pouvoir builder le client sans erreur.

