# Debug Cloudinary - Guide de diagnostic

## Problème
L'upload d'image retourne un chemin local (`/uploads/images/...`) au lieu d'une URL Cloudinary (`https://res.cloudinary.com/...`).

## Solution 1 : Vérifier les logs sur Railway

### Comment voir les logs sur Railway :

1. **Via le Dashboard Railway** :
   - Allez sur votre projet Railway
   - Cliquez sur votre service backend
   - Ouvrez l'onglet **"Deployments"** ou **"Logs"**
   - Cherchez les logs qui commencent par `📤 IMAGE UPLOAD ENDPOINT CALLED`

2. **Via la CLI Railway** (si installée) :
   ```bash
   railway logs
   ```

### Logs à chercher :

```
========================================
📤 IMAGE UPLOAD ENDPOINT CALLED
========================================
useCloudinary: ❌ FALSE  <-- Si c'est FALSE, Cloudinary n'est pas configuré
```

Si vous voyez :
```
⚠️  CLOUDINARY NOT CONFIGURED - CHECK ENVIRONMENT VARIABLES:
   CLOUDINARY_CLOUD_NAME: ❌ Missing
   CLOUDINARY_API_KEY: ❌ Missing
   CLOUDINARY_API_SECRET: ❌ Missing
```

Cela signifie que les variables d'environnement ne sont **pas configurées sur Railway**.

## Solution 2 : Configurer les variables d'environnement sur Railway

### Étapes :

1. **Allez sur Railway Dashboard** → Votre projet → Votre service backend

2. **Ouvrez l'onglet "Variables"**

3. **Ajoutez ces 3 variables** :
   - `CLOUDINARY_CLOUD_NAME` = Votre Cloud Name (ID Cloudinary)
   - `CLOUDINARY_API_KEY` = Votre API Key
   - `CLOUDINARY_API_SECRET` = Votre API Secret

4. **Redéployez** le service (Railway redéploie automatiquement quand vous modifiez les variables)

### Où trouver vos clés Cloudinary :

1. Connectez-vous sur [cloudinary.com](https://cloudinary.com)
2. Allez dans **Dashboard**
3. Vous verrez :
   - **Cloud Name** : C'est votre `CLOUDINARY_CLOUD_NAME`
   - **API Key** : C'est votre `CLOUDINARY_API_KEY`
   - **API Secret** : Cliquez sur "Reveal" pour voir votre `CLOUDINARY_API_SECRET`

## Solution 3 : Vérifier la réponse JSON

Maintenant, la réponse JSON inclut un champ `storage` qui indique si Cloudinary a été utilisé :

```json
{
  "message": "Image uploaded successfully",
  "image": {
    "url": "/uploads/images/...",
    "path": "/uploads/images/..."
  },
  "storage": {
    "type": "local",  // ou "cloudinary"
    "isCloudinary": false,  // ou true
    "cloudinaryError": null  // ou le message d'erreur si Cloudinary a échoué
  }
}
```

### Interprétation :

- `"type": "local"` → Cloudinary n'est **pas utilisé**
- `"type": "cloudinary"` → Cloudinary est **utilisé** ✅
- `"cloudinaryError": "..."` → Cloudinary a **échoué** (voir le message d'erreur)

## Solution 4 : Tester localement

Pour tester localement, créez un fichier `.env` à la racine du projet :

```env
CLOUDINARY_CLOUD_NAME=votre_cloud_name
CLOUDINARY_API_KEY=votre_api_key
CLOUDINARY_API_SECRET=votre_api_secret
```

Puis redémarrez le serveur :
```bash
npm start
```

## Logs améliorés

J'ai ajouté des logs très détaillés qui affichent :

- ✅ Si Cloudinary est configuré ou non
- ✅ Si l'upload Cloudinary réussit ou échoue
- ✅ Le message d'erreur exact si Cloudinary échoue
- ✅ Le type de stockage utilisé (local ou cloudinary)

Ces logs apparaissent dans la console Railway et vous permettront de diagnostiquer le problème facilement.

## Prochaines étapes

1. **Vérifiez les logs Railway** après un upload d'image
2. **Vérifiez les variables d'environnement** sur Railway
3. **Redéployez** si vous avez modifié les variables
4. **Testez un upload** et vérifiez la réponse JSON (champ `storage`)

