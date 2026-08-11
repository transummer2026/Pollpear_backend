# API publique — 5 ressources REST (GET / POST / PATCH / DELETE)

## Conventions

**Auth** : clé d'API (`ApiKey`). La clé agit au nom de `ApiKey.ownerId` — c'est ce
qui donne un sens à « ses » rooms, `/me`, et aux règles de propriété.

**Les 4 verbes se répartissent entre la collection et l'item** :

```txt
/x        -> GET (liste paginée), POST (créer)
/x/{id}   -> GET (détail), PATCH (modifier), DELETE (supprimer)
```

**Pagination** : toute liste prend `?page=1&limit=20` (limit max 100) et renvoie
`{ data: [...], page, limit, total }`.

**DELETE = soft-delete** partout (`Poll.status=deleted`, `Room.status=closed`,
`User.isDeleted`+`deletedAt`), sauf `/hashtags/{id}` qui fait un vrai DELETE.

**Jamais renvoyé** : `passwordHash`, `ApiKey.keyHash`, les tokens OAuth.

---

## 1. /users

```txt
-> GET: liste paginée { id, username, avatarUrl, score }
        exclut isDeleted=true et visibility=private
-> POST: inscription
        body { username, email, password, birthdate, gender, nationality }
        201 { id, username } | 409 si username ou email déjà pris
```

### /users/{id}

```txt
-> GET: { username, bio, avatarUrl, score, pearsPals, activeRooms, pollsCreated }
        404 si isDeleted, ou visibility=private
-> PATCH: autorisé si {id} == ApiKey.ownerId, sinon 403
        body partiel { name?, surname?, bio?, city?, state?, country?, company?,
                       gender?, visibility?, userTheme? }
-> DELETE: autorisé si {id} == ApiKey.ownerId ou role=admin
        soft-delete: isDeleted=true, deletedAt=now  -> 204
```

Les 3 compteurs :

- `pearsPals` : `Friendship` où `status=accepted` **dans les deux sens**
  (`requesterId = id` OU `addresseeId = id`)
- `activeRooms` : `RoomMember` joint à `Room` où `Room.status=active`
- `pollsCreated` : `Poll` où `createdById = id` **et** `status != deleted`

---

## 2. /polls

```txt
-> GET: polls où visibility=public et status=active, paginé
        filtres ?hashtag=&type=&createdBy=
        { id, title, type, endsAt, status, createdBy: { id, username } }
-> POST: body { title, description?, type, endsAt, visibility, allowChangeVote,
                isAnonymous, roomId?, options: [{ label, order,
                sliderLeftLabel?, sliderRightLabel? }] }
        createdById vient de la clé, jamais du body
        options >= 2 obligatoires si type = single_choice | multiple_choice
        poll + options créés dans UNE transaction  -> 201
```

### /polls/{id}

```txt
-> GET: le poll + ses options (isDeleted=false), triées par order
        404 si status=deleted, ou visibility=private et non-membre
-> PATCH: owner uniquement, et seulement si status=pending
        body partiel { title?, description?, endsAt?, visibility? }
        409 si status=active (on ne change pas les règles en cours de vote)
-> DELETE: owner ou admin -> status=deleted  -> 204
```

### /polls/{id}/results

```txt
-> GET: forme dépendante de Poll.type (union discriminée sur `type`)
        single_choice | multiple_choice
            { type, totalVotes, options: [{ optionId, label, count }] }
        slider
            { type, totalVotes, average, min, max, distribution }
        free_field
            { type, totalVotes, answers: [...] }  -- paginé
        403 si status=pending
```

Chemin d'agrégation : `Vote -> VoteOption -> Option -> Poll` (`Vote` n'a pas de
`pollId`). Pour `slider` et `free_field`, la réponse est dans `Vote.label`.
Si `isAnonymous=true`, aucune identité d'auteur ne sort, jamais.

---

## 3. /hashtags

```txt
-> GET: liste des hashtags où isVisible=true, paginé
        { id, name, pollCount }
-> POST: role=moderator|admin
        body { name, isVisible? }  -> 201 | 409 si name existe (name est @unique)
```

### /hashtags/{id}

```txt
-> GET: les polls publics portant ce hashtag, paginé (même forme que GET /polls)
-> PATCH: role=moderator|admin, body partiel { name?, isVisible? }
-> DELETE: role=admin -- vrai DELETE, sûr grâce au schéma:
        PollHashtag est en Cascade, Report.hashtagId en SetNull  -> 204
```

---

## 4. /rooms

```txt
-> GET: rooms où visibility=public et status=active,
        + celles où ApiKey.ownerId est RoomMember  -- paginé
        { id, name, bannerUrl, visibility, status, memberCount }
-> POST: body { name, description?, visibility, bannerUrl? }
        createdById vient de la clé, status=active
        crée aussi le RoomMember du créateur, dans la MÊME transaction  -> 201
```

### /rooms/{id}

```txt
-> GET: room + memberCount + pollCount, 404 si private et non-membre
-> PATCH: owner uniquement, body partiel { name?, description?, visibility? }
-> DELETE: owner ou admin -> status=closed  -> 204
```

---

## 5. /admin/users

Toutes les routes : `role = admin` requis, sinon 403.

```txt
-> GET: tous les users y compris isDeleted, paginé
        filtres ?role=&isDeleted=&search=
        { id, username, email, role, isOnline, isDeleted, createdAt }
-> POST: création d'un compte staff
        body { username, email, password, birthdate, gender, nationality, role }
        -> 201
```

### /admin/users/{id}

```txt
-> GET: champs scalaires du user + compteurs, PAS les relations complètes
        { ...scalaires sauf passwordHash,
          counts: { pollsCreated, roomsCreated, votes, messages,
                    bansReceived, reportsGiven, reportsReceived, apiKeys } }
-> PATCH: body partiel { role?, isDeleted?, visibility?, isEmailVerified? }
-> DELETE: soft-delete -- isDeleted=true, deletedAt=now  -> 204
```

Le dump de toutes les relations dans une seule réponse est écarté : `apiKeys`
contient `keyHash`, et `messages`/`votes` peuvent faire des dizaines de milliers
de lignes. Les relations volumineuses passent par des sous-ressources paginées
si le besoin se confirme (`/admin/users/{id}/bans`, `/reports`, `/apikeys`).

---

## 6. /me — raccourci, pas une 3e implémentation

`/me` résout `ApiKey.ownerId` puis appelle **le même service** que `/users/{id}`.
Aucune logique dupliquée.

```txt
-> GET: { username, name, surname, email, birthdate, role, gender, nationality,
          city, state, country, company, bio, score, isOnline, isEmailVerified,
          visibility, lastSeenAt, avatarUrl, bannerUrl, createdAt, updatedAt,
          userTheme }
-> PATCH: identique à PATCH /users/{ownerId}
-> DELETE: identique à DELETE /users/{ownerId} (soft-delete)
```

---

## Décompte pour la validation

5 ressources portent les 4 verbes en entier : `/users`, `/polls`, `/hashtags`,
`/rooms`, `/admin/users`. `/me` est un bonus (GET / PATCH / DELETE).

## Valeurs posées par le service, pas par le schéma

Aucune migration n'est faite pour l'API publique — le schéma reste tel quel.

Ces champs sont NOT NULL sans `@default` : Prisma exige donc une valeur à la
création. Elle est fournie par le service, jamais par le body du client.

| Champ               | Valeur posée au `create()`                              |
| ------------------- | ------------------------------------------------------- |
| `User.role`         | `user` — **jamais** lu depuis le body sur `POST /users` |
| `User.userTheme`    | `system`                                                |
| `Poll.status`       | `pending`                                               |
| `Room.status`       | `active`                                                |
| `Room.bannerUrl`    | `/uploads/banners/default.svg`                          |
| `Hashtag.isVisible` | `true`                                                  |

Le point de sécurité tient au service, pas au schéma : ne pas spread le body
tel quel dans `create()`, lister les champs autorisés un par un.

Connu, mais hors scope ici : `Ban.unbannedAt` est NOT NULL, ce qui rend un ban
actif (jamais levé) impossible à représenter. Aucune route de l'API publique
n'écrit dans `Ban` — ça se traitera au moment d'implémenter le ban.

---

## Découpage en PR et branches

Convention existante du repo : `feat/kebab-case`. Le préfixe `api-` distingue
l'API publique du CRUD interne déjà en cours (`feat/pollcrud`, `feat/votecrud`).

### Ordre de merge

Les 3 premières sont séquentielles, les 5 ressources sont parallélisables.

| #   | Repo     | Branche                    | Contenu                                                                    |
| --- | -------- | -------------------------- | -------------------------------------------------------------------------- |
| 1   | backend  | `feat/api-key-auth`        | `ApiKeyGuard`, génération + révocation de clés, DTO de pagination partagés |
| 2   | frontend | `feat/api-key-request`     | bouton « demander une clé », dépend de la #1                               |
| 3   | infra    | `feat/api-public-exposure` | route gateway `/api/v1`, rate-limiting par clé                             |
| 4   | backend  | `feat/api-users`           | `/users`, `/users/{id}`, `/me`                                             |
| 5   | backend  | `feat/api-polls`           | `/polls`, `/polls/{id}`, `/polls/{id}/results`                             |
| 6   | backend  | `feat/api-hashtags`        | `/hashtags`, `/hashtags/{id}`                                              |
| 7   | backend  | `feat/api-rooms`           | `/rooms`, `/rooms/{id}`                                                    |
| 8   | backend  | `feat/api-admin-users`     | `/admin/users`, `/admin/users/{id}`                                        |

Total : 6 PR backend, 1 frontend, 1 infra. Aucune migration.

### Pourquoi cet ordre

- **#1 avant #2** : sans endpoint de création de clé, le bouton front n'a rien
  à appeler — la PR front serait du code mort.
- **#1 porte les DTO partagés** : sinon c'est la première PR de ressource qui
  les livre « en passant », et elle devient illisible à relire.
- **#3 indépendante** : peut avancer en parallèle dès le début, doit juste être
  mergée avant que l'API soit joignable de l'extérieur.
- **#4 à #8 en parallèle** : modules Nest indépendants, aucun fichier commun
  une fois la #1 mergée.

### Submodules

Chaque PR backend / frontend / infra vit dans son propre repo. Le bump du
pointeur se fait ensuite dans `Pollpear` (`chore/sync-submodule`), une fois la
PR du submodule mergée.

### À vérifier avant de démarrer la #6

`feat/pollcrud` et `feat/votecrud` existent déjà sur le backend et touchent le
même module. Les merger d'abord, ou construire dessus — mais pas les deux en
parallèle.
