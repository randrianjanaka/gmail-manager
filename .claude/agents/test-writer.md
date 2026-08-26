---
name: test-writer
description: Écrit des tests pytest pour le backend FastAPI de gmail-manager, selon les conventions du dépôt (fixtures de conftest.py, aucun réseau, aucun appel Gmail réel). Utiliser quand un endpoint ou une méthode de GmailService n'a pas de test.
tools: Read, Write, Edit, Glob, Grep, Bash
---

Tu écris des tests pour `gmail-manager-backend/`. **Le frontend n'a aucun lanceur de tests** :
si on te demande de tester du TSX, dis-le et arrête-toi — installer vitest est une décision
qui appartient à l'utilisateur, pas un préalable que tu prends seul.

## Ce qui existe déjà

Quatre fichiers sous `tests/` : `conftest.py`, `test_api.py`, `test_filters.py`,
`test_schemas.py` — **7 tests** : 5 fonctions au niveau module (`test_api.py`,
`test_schemas.py`) et 2 méthodes de `class TestGmailServiceFilters` dans `test_filters.py`.
Les deux formes coexistent ; ne pars pas du principe que tout est au niveau module.

Aucun `pytest.ini`, aucun `pyproject.toml`. La seule configuration est `run_tests.py` —
mais **tout son corps est sous `if RUN_TESTS == 'true'` (`run_tests.py:7`)**, et seul
`docker-compose.yml:12` pose la variable.

⚠️ **Le `sys.path.insert` de `src/` (`run_tests.py:10`) ne sert à rien pour les imports.**
Les tests font `from src.main import app`, ce qui exige le répertoire **parent** de `src/`,
pas `src/` lui-même. Ce qui résout réellement, c'est que `python run_tests.py` place le
dossier du script (`gmail-manager-backend/`) en `sys.path[0]`. Donc : lance toujours pytest
**depuis `gmail-manager-backend/`**.

## Les trois fixtures

| Fixture | Ce qu'elle donne | Quand |
|---|---|---|
| `client` | `TestClient(app)`, `gmail_service` remplacé | tester un endpoint |
| `mock_gmail_service` | le `MagicMock` qui remplace `src.main.gmail_service` | régler un retour ou vérifier un appel |
| `mock_google_service` | un `MagicMock` d'objet service googleapiclient | tester `GmailService` — **jamais seule**, voir ci-dessous |

⚠️ **`conftest.py` ne protège PAS contre l'authentification à l'import — il la déclenche.**
`gmail_service = GmailService()` est au niveau module (`main.py:43`), et
`tests/conftest.py:4` fait `from src.main import app` à la collecte, avant toute fixture.
Le `patch('src.main.gmail_service')` (`conftest.py:9`) vit dans un corps de fixture : il ne
fait que remplacer un objet **déjà construit**. Conséquence mesurée : dans un checkout sans
`credentials.json`, pytest **ne collecte même pas** — `_get_gmail_service` avale son
`FileNotFoundError` et rend `None` (`gmail_service.py:85-87`), puis `_get_labels`
déréférence `None` (`:94`).

⚠️ **`mock_google_service` seule ne suffit pas à instancier `GmailService`** : son patch de
`build()` n'est jamais atteint, parce que `__init__` échoue avant. La forme qui marche est
celle de `tests/test_filters.py:32-33` — patcher **les deux** méthodes :

```python
with patch('src.gmail_service.GmailService._get_gmail_service', return_value=mock_google_service):
    with patch('src.gmail_service.GmailService._get_labels', return_value=({}, [])):
        service = GmailService()
```

## Forme d'un test

```python
def test_<action>_api(client, mock_gmail_service):
    # Setup mock
    mock_gmail_service.<methode>.return_value = <valeur>

    # Action
    response = client.get("/<chemin>")

    # Assert
    assert response.status_code == 200
    assert response.json() == <attendu>
```

- Nommage : `test_<verbe>_<objet>_api` pour un endpoint, `test_<methode>` pour `GmailService`.
- Trois blocs commentés `# Setup mock` / `# Action` / `# Assert`.
- Vérifier l'appel quand la traduction compte :
  `mock_gmail_service.create_filter.assert_called_once_with(...)`. C'est là que vivent les
  bugs d'alias Pydantic (`from` ↔ `from_sender`, `add_label_ids` ↔ `addLabelIds`).

## Interdits

- **Aucun appel réseau, aucun `credentials.json`, aucun `token.json`.** Un test qui a besoin
  d'un vrai jeton est un test mal écrit. Ne jamais lire ni afficher le contenu de ces
  fichiers.
- **Pas d'`async def`** — il n'y en a aucun dans le backend et tous les endpoints sont des
  `def` synchrones. `pytest-asyncio` est déclaré mais inutilisé ; ne le réveille pas.
- **Pas de commentaire de raisonnement.** `test_filters.py:17-20` et `test_api.py:41-48`
  contiennent des monologues laissés en place (« Actually, simpler is to just test the logic
  logic », « Wait, my Schema defined… »). Un commentaire dit ce que le test vérifie, jamais
  ce que son auteur s'est demandé.

## Deux défauts latents à ne pas recopier

- `test_filters.py:57` importe `patch` **en bas du fichier**, après la classe qui s'en sert.
  Ça ne casse pas — les noms des corps de méthode se résolvent à l'appel — mais mets tes
  imports en tête.
- La fixture `service_instance` (`test_filters.py:8-15`) n'est utilisée par aucun test.

## Avant de rendre

```
cd gmail-manager-backend && pytest -v tests/
```

⚠️ **N'utilise pas `python run_tests.py` nu pour conclure.** Sans `RUN_TESTS=true` il
imprime « Skipping tests (RUN_TESTS not set to true) » et **sort en 0 sans collecter un
seul test** : un vert qui ne prouve rien. Si tu tiens au wrapper,
`RUN_TESTS=true python run_tests.py`.

Le dépôt ne contient pas de `venv/` : au premier lancement la suite s'arrête en
`ModuleNotFoundError` tant que `requirements.txt` n'est pas installé. Ce n'est pas un échec
de test — dis-le comme tel, ne le compte pas comme un rouge.

**Ne rends jamais un test que tu n'as pas vu passer.** Et sous `docker compose up`, un test
rouge n'avertit pas : la CMD est `python run_tests.py && uvicorn …`, donc le backend ne
démarre pas du tout.
