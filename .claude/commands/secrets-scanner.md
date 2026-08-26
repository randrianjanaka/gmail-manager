---
description: Cherche des secrets en dur dans le dépôt — et vérifie que les credentials OAuth Gmail ne fuient nulle part
argument-hint: (aucun, ou un chemin à restreindre)
allowed-tools: Read, Grep, Glob, Bash
---

# /secrets-scanner

## Périmètre

Tout le dépôt, **sauf** `node_modules/`, `.next/`, `venv/`, `__pycache__/`, `.git/`.
Pas de liste blanche de sous-répertoires : un secret se met là où on ne le cherche pas.

## Méthode

**Réutiliser le catalogue de regex déjà écrit dans `.claude/hooks/secret-scanner.py`**
(constante `PATTERNS`, 23 motifs) plutôt que d'en réinventer un — il est maintenu au même
endroit que le hook qui bloque les commits. Le lire, puis appliquer chaque motif avec Grep
sur le périmètre.

⚠️ **22 motifs sur 23 passent tels quels ; un seul ne passe pas.** « Hardcoded Password »
(ligne 38 du hook) contient un lookbehind Python `(?<![-\w])` que ripgrep — le moteur de
l'outil Grep — **rejette sans chercher** (`error: look-around … is not supported`), et
l'outil n'expose pas `--pcre2`. Le rejet est bruyant, mais son effet est celui d'une
absence : ce motif n'est jamais évalué. Le remplacer par `(^|[^-\w])(password|passwd|pwd)…`
pour ce passage, ou l'appliquer à part en Python.

## Ce qui est spécifique à ce dépôt

**Les deux fichiers les plus sensibles ne sont pas des chaînes en dur, ce sont des
fichiers entiers** : `gmail-manager-backend/credentials.json` (client secret Google) et
`token.json` (jeton de rafraîchissement). Ils donnent un accès `gmail.modify` à une vraie
boîte mail.

⚠️ **Ne jamais ouvrir, afficher, citer ni recopier leur contenu** — y compris pour
« vérifier ». Ce qu'il faut établir se prouve sans les lire :

| Contrôle | Commande |
|---|---|
| Non suivis | `git ls-files --error-unmatch gmail-manager-backend/credentials.json` (doit échouer) |
| Ignorés | `git check-ignore -v gmail-manager-backend/credentials.json` |
| Jamais dans l'historique | `git rev-list --all --objects \| grep -c -F -e credentials.json -e token.json` (doit rendre 0) |

⚠️ **Ne pas écrire ce contrôle avec un pathspec `**/`.** `git log --all -- "**/x"` **ne
voit pas** un fichier commité à la RACINE : sans la magie `:(glob)`, git compare en mode
non-pathname, donc `**/` exige un `/` littéral. Mesuré en labo sur deux commits, un par
emplacement : `**/x` en rend **1**, `*x` en rend **2**. Et la racine est justement le cas
réaliste — `config.py:15-16` définit les deux fichiers en chemins relatifs résolus contre
le répertoire courant. `git rev-list --all --objects` ignore la question du pathspec :
il énumère tous les objets de tous les arbres.

⚠️ **Et `git log … | wc -l` rend `1` sur un résultat VIDE** (la sortie est un simple `\n`).
Compter avec `grep -c .`, ou vérifier avec `od -c`. Un `1` lu comme « un commit trouvé »
est un faux positif d'historique.

**Quatre autres points à vérifier à chaque passage :**

1. **`.dockerignore`** — il n'existe pas, et le Dockerfile backend fait `COPY . /app/`. Les
   deux fichiers de credentials entrent donc dans l'image dès qu'ils sont présents dans le
   contexte de build. À signaler tant que ce n'est pas corrigé.
2. **`SCOPES`** dans `src/config.py` — tout élargissement est un incident de sécurité, pas
   une amélioration.
3. **Les journaux** — grep `logging\..*token`, `logging\..*cred`, `print(.*creds`. Un
   jeton dans un log est un jeton public.
4. **Un credential à la RACINE** — `git check-ignore -v credentials.json token.json` doit
   sortir en **0** et nommer le `.gitignore` racine. Les lignes y ont été posées le
   2026-08-26 précisément parce que le `.gitignore` qui couvrait ces noms est cantonné à
   `gmail-manager-backend/` : si elles disparaissent, un lancement du backend depuis la
   racine y écrit des identifiants **stageables**.

## Sortie

| # | Fichier:ligne | Type | Verdict |
|---|---|---|---|

Puis, séparément, ce qui est **conforme** — en une ligne, avec la commande qui le prouve.
Un rapport qui ne dit que les problèmes ne permet pas de savoir ce qui a été regardé.

**Ne jamais recopier la valeur d'un secret trouvé.** Le localiser suffit.
