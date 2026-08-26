# Verification Before Assertion

> Procédure, pas posture. `critical-thinking.md` traite de l'attitude face au doute ; ce
> fichier traite des affirmations qui ne **semblent pas** douteuses et qui sont fausses quand
> même. Chaque ligne se déclenche sur un motif **syntaxique** du brouillon, pas sur une
> impression d'incertitude — c'est ce qui la rend applicable, et vérifiable de l'extérieur.

## Table de déclenchement

Avant d'écrire l'une de ces formes dans une réponse, une spec, un plan, un commit ou un
commentaire de code, l'acte de vérification correspondant est **obligatoire**.

| Forme d'affirmation | Interdite sans |
|---|---|
| « X est le seul… », « rien d'autre ne… », « c'est le seul cas où… » | énumérer la population entière, pas un voisin |
| « X n'existe pas », « il n'y a pas de… », « ce chemin est mort » | deux recherches de **formes différentes** (glob ET grep, nom ET comportement) |
| « ce flag survit », « ce champ n'est jamais nettoyé », « rien ne remet à zéro… » | lire le bloc englobant **jusqu'à son accolade fermante** |
| « il faut implémenter X », « X n'existe pas encore » | grep du symbole **et** du comportement avant de planifier de le construire |
| « A est causé par B » | nommer au moins une cause alternative et l'écarter explicitement |
| un compte, un total, un statut | le re-dériver **dans le même tour** que l'affirmation, jamais depuis un tour antérieur ni depuis une mémoire |
| « voici l'état actuel » | un horodatage, ou une re-requête |
| une mesure plus faible que ce que la théorie prédit | l'expliquer **avant** de conclure |

## La dernière ligne est la plus importante

Une mesure qui contredit l'hypothèse est souvent lue comme un appui parce qu'elle est
non-nulle. Exemple réel (2026-07-29) : théorie « `dropData` n'est jamais nettoyé du blob » ;
mesure « **4** domaines portent un `dropData` collant ». Lu comme confirmation. Or 4, sur ~600
retraits et des milliers de relances, **réfutait** la théorie — s'il n'était jamais consommé,
ils seraient des milliers. Le nettoyage existait bien, six lignes sous un bloc déjà ouvert.

Règle : **un ordre de grandeur inattendu est une réfutation à expliquer, pas un détail à
rapporter.**

## Pourquoi ces lignes précisément

Chacune vient d'une erreur commise, pas d'un risque imaginé :

- *seul / rien d'autre* — « `dropData` est le seul paramètre sans branche `else` » : généralisé
  depuis un seul voisin. En réalité trois paramètres sur neuf en sont dépourvus.
- *n'existe pas* — « aucun test dans ce service » sur la foi d'un `Glob **/test*` négatif.
  `backend/tests/test_es_client.py` existait et un correctif l'a cassé.
- *bloc englobant* — raisonnement sur « ce qui se passe après l'acceptation du job » mené sur
  des fragments (`:675-680`, `:709-728`) au lieu du bloc `:708-787`. La réfutation était dedans.
- *il faut implémenter X* — une tâche de plan a failli être écrite pour construire un
  comportement déjà présent dans le fichier visé.
- *A causé par B* — 112 domaines en statut 7 attribués à des sélecteurs périmés, alors que le
  lot concerné n'avait aucun sélecteur : cause impossible, correctif qui en découlait inutile.
- *compte / total* — « 22 des 23 » affirmé sans calcul ; le calcul donnait 23 sur 23.
- *état actuel* — un bilan présenté comme définitif alors qu'il bougeait encore ; 36 minutes
  plus tard, 79 domaines bloqués étaient devenus 40.

## Ce que cette règle ne demande PAS

Elle ne demande pas de tout re-vérifier, ni d'ajouter des réserves partout. Une affirmation
hors de la table se dit normalement. L'inflation de prudence a un coût réel : elle noie les
vraies incertitudes et rend le propos inexploitable.

Elle ne remplace pas non plus **[UNCLEAR]** : ce marqueur sert quand le doute est ressenti.
Cette table sert quand il ne l'est pas.

## Application

Une affirmation de la table écrite sans son acte de vérification est une erreur au même titre
qu'un test qui échoue — pas un détail de style. Elle se corrige en faisant la vérification,
puis en énonçant le résultat, y compris s'il contredit ce qui venait d'être écrit.

Le lecteur peut reprendre une affirmation en pointant la ligne de la table qu'elle viole.
C'est le but : rendre le manquement nommable sans avoir à débattre du fond.
