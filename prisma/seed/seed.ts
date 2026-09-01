import { faker } from '@faker-js/faker';
import { hash, argon2id } from 'argon2';
import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { VaultService } from '../../src/vault/vault.service';
import { canonicalPair } from '../../src/friendship/friendship.pair';
import Redis from 'ioredis';
import { apiKeyCacheKey } from '../../src/redis/redis-keys';
import {
  expiryFromTtl,
  generateApiKey,
  remainingSeconds,
} from '../../src/api-key/api-key.util';
import {
  PrismaClient,
  Prisma,
  UserRole,
  Gender,
  UserTheme,
  Visibility,
  RoomStatus,
  PollType,
  PollStatus,
  FriendshipStatus,
  NotificationType,
} from '../../src/generated/prisma/client.js';

dotenv.config({ path: '../.env' });

const USER_COUNT = 50;
const ROOM_COUNT = 25;
const DEFAULT_PASSWORD = 'Password123!';
const API_KEY_LIFETIME_SECONDS = 365 * 24 * 60 * 60;

type IssuedKey = {
  role: UserRole;
  username: string;
  key: string;
  keyHash: string;
  ownerId: number;
  expiredAt: Date;
};

const API_ACCOUNTS: { username: string; role: UserRole }[] = [
  { username: 'apiuser', role: UserRole.user },
  { username: 'apimoderator', role: UserRole.moderator },
  { username: 'apiadmin', role: UserRole.admin },
];
const JOJO_PENDING_REQUESTS = 30;

type CrewName = 'jojo' | 'hygie' | 'pieric' | 'raph';

const CREW_ROOM_PLAN: { members: CrewName[]; visibility: Visibility }[] = [
  {
    members: ['jojo', 'hygie', 'pieric', 'raph'],
    visibility: Visibility.public,
  },
  { members: ['jojo', 'hygie'], visibility: Visibility.private },
  { members: ['raph', 'pieric'], visibility: Visibility.private },
  { members: ['jojo', 'raph', 'pieric'], visibility: Visibility.public },
  { members: ['hygie', 'pieric'], visibility: Visibility.private },
  { members: ['jojo', 'raph'], visibility: Visibility.public },
];

const BUSY_ROOM_MESSAGES = 120;
const ROOM_MESSAGES_MIN = 6;
const ROOM_MESSAGES_MAX = 30;
const CHATTY_ROOM_COUNT = 6;
const DELETED_MESSAGE_DEMO = 5;
const VERIFIED_PROBABILITY = 0.85;
const COMPANY_PROBABILITY = 0.6;
const BIO_PROBABILITY = 0.7;
const PRIVATE_PROFILE_PROBABILITY = 0.2;

const HASHTAG_NAMES = [
  'tech',
  'ai',
  'politics',
  'sport',
  'food',
  'music',
  'gaming',
  'movies',
  'travel',
  'school42',
  'health',
  'science',
  'news',
  'memes',
  'valais',
  'bocal',
  'apero',
];
const HIDDEN_HASHTAGS = new Set(['memes', 'news']);

const POLL_TYPE_PLAN: PollType[] = [
  ...Array<PollType>(16).fill(PollType.single_choice),
  ...Array<PollType>(12).fill(PollType.multiple_choice),
  ...Array<PollType>(6).fill(PollType.slider),
  ...Array<PollType>(6).fill(PollType.free_field),
];
const POLL_STATUS_PLAN: PollStatus[] = [
  ...Array<PollStatus>(32).fill(PollStatus.active),
  ...Array<PollStatus>(8).fill(PollStatus.closed),
];
const FRIENDSHIP_STATUS_PLAN: FriendshipStatus[] = [
  ...Array<FriendshipStatus>(70).fill(FriendshipStatus.accepted),
  ...Array<FriendshipStatus>(20).fill(FriendshipStatus.pending),
  ...Array<FriendshipStatus>(10).fill(FriendshipStatus.rejected),
];

const SCORE_PER_VOTE = 10;
const SCORE_PER_ROOM = 5;
const SCORE_PER_POLL = 20;
const SLIDER_MIN = 0;
const SLIDER_MAX = 10;
const MEMBERS_MIN = 3;
const MEMBERS_MAX = 12;
const HOT_POLL_COUNT = 5;
const DAY_MS = 86_400_000;

const vault = new VaultService();
let prisma: PrismaClient;

faker.seed(12345);

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY_MS);
const inDays = (n: number) => new Date(now.getTime() + n * DAY_MS);
const accountCreatedAt = () =>
  faker.date.between({ from: daysAgo(1460), to: daysAgo(548) });

// --- CUSTOM USERS ---
const CUSTOM_USERS = [
  {
    username: 'Jojo_du_38',
    email: 'jojodu38@92Paris.fr',
    avatarUrl: '/uploads/avatars/Jojo_du_38.jpeg',
    bio: "Essaie de perser dans le rap. C'est difficile, mon seul sujet c'est la correction de prononciation en anglais",
    gender: Gender.female,
    nationality: 'Swiss',
    country: 'Switzerland',
    birthdate: new Date('1998-12-01'),
    name: 'Josephine',
    surname: 'Pear',
    city: 'Lausanne',
    isEmailVerified: true,
  },
  {
    username: 'Miguel',
    email: 'MiguelAdeLaChance@gmail.ch',
    avatarUrl: '/uploads/avatars/Miguel.jpeg',
    bio: 'célébrité à starbucks, miguel est une icone bien connue.',
    gender: Gender.other,
    nationality: 'Portugese',
    country: 'Switzerland',
    birthdate: new Date('1993-08-09'),
    name: 'Miguel',
    surname: 'Pear',
    city: 'Lausanne',
    isEmailVerified: true,
  },
  {
    username: 'P2monts',
    email: 'p2mont@proton.ch',
    avatarUrl: '/uploads/avatars/P2monts.jpeg',
    bio: "J'aime le valais, j'aime les crocs. J'aime mcdo et le coca",
    gender: Gender.male,
    nationality: 'Valais',
    country: 'Switzerland',
    birthdate: new Date('1500-10-06'),
    name: 'Pédemont',
    surname: 'Pear',
    city: 'Sion',
    isEmailVerified: true,
  },
  {
    username: 'GhostVincent',
    email: 'GhostVincent@bocalpartoutJusticeNullepart.ch',
    avatarUrl: '/uploads/avatars/GhostVincent.jpeg',
    bio: "Qui vient faire une pause ? Qui pour une bière ? Ahhh moi j'ai fini ma journée",
    gender: Gender.male,
    nationality: 'French',
    country: 'Switzerland',
    birthdate: new Date('1993-09-08'),
    name: 'Vincent',
    surname: 'Pear',
    city: 'Lausanne',
    isEmailVerified: true,
  },
  {
    username: 'MasterclassBen',
    email: 'BenRobotFatigué@42.ch',
    avatarUrl: '/uploads/avatars/MasterclassBen.jpeg',
    bio: `"Ils s'attendent à ce que je joue équitablement. On ne joue même pas au même jeu." Swain, LOL`,
    gender: Gender.other,
    nationality: 'FailleDeLinvocateur',
    country: 'Switzerland',
    birthdate: new Date('1993-05-01'),
    name: 'Bénédicte',
    surname: 'Pear',
    city: 'Lausanne',
    isEmailVerified: true,
  },
  {
    username: 'RaphOps',
    email: 'Raph@claude.com',
    avatarUrl: '/uploads/avatars/RaphOps.jpeg',
    bio: 'Il me semble que la CI est une invention légendaire.',
    gender: Gender.male,
    nationality: 'Mexicain',
    country: 'Switzerland',
    birthdate: new Date('1994-05-01'),
    name: 'Raph',
    surname: 'Pear',
    city: 'Lausanne',
    isEmailVerified: true,
  },
  {
    username: 'Jose',
    email: 'Josephine@super.com',
    avatarUrl: '/uploads/avatars/jose.jpeg',
    bio: "J'aime pas qu'on m'appelle José, ni les gens qui parle dans les trains, ni ceux qui écoutent de la musique dans le bus. En fait j'aime pas les gens",
    gender: Gender.female,
    nationality: 'American',
    country: 'Switzerland',
    birthdate: new Date('1995-05-01'),
    name: 'José',
    surname: 'Pear',
    city: 'Lausanne',
    isEmailVerified: true,
  },
  {
    username: 'Eduard_eau',
    email: 'canard@colvert.ch',
    avatarUrl: '/uploads/avatars/Eduard_eau.jpeg',
    bio: 'Bocalien aux choix de chapeau douteux, bois plus de café que conseillé pour la santé',
    gender: Gender.other,
    nationality: 'Geneve',
    country: 'Switzerland',
    birthdate: new Date('1996-05-01'),
    name: 'Eduardo',
    surname: 'Pear',
    city: 'Geneva',
    isEmailVerified: true,
  },
  {
    username: 'Aicka',
    email: 'lavieille@baby.com',
    avatarUrl: '/uploads/avatars/Aicka.jpeg',
    bio: 'Chienne un peu vieille mais très belle, aime aller au lac et protège Wilma',
    gender: Gender.female,
    nationality: 'Belgian',
    country: 'Switzerland',
    birthdate: new Date('1997-05-01'),
    name: 'Aicka',
    surname: 'Pear',
    city: 'Lausanne',
    isEmailVerified: true,
  },
  {
    username: 'Poupou',
    email: 'proutprout@cul.ch',
    avatarUrl: '/uploads/avatars/Poupou.jpeg',
    bio: 'Ca pète ca ronfle mais ca le fait avec confiance.',
    gender: Gender.male,
    nationality: 'French',
    country: 'Switzerland',
    birthdate: new Date('1998-05-01'),
    name: 'Poupou',
    surname: 'Pear',
    city: 'Lausanne',
    isEmailVerified: true,
  },
  {
    username: 'IcePack',
    email: 'telephone@cooler.com',
    avatarUrl: '/uploads/avatars/Icepack.jpeg',
    bio: "Compagnon de vie de jojo, j'aide à construire les dockers sur un réseau peu fiable",
    gender: Gender.other,
    nationality: 'Congelateur',
    country: 'Switzerland',
    birthdate: new Date('1992-03-02'),
    name: 'Ice',
    surname: 'Pack',
    city: 'Lausanne',
    isEmailVerified: true,
  },
  {
    username: 'alexis_est_Chauve',
    email: 'bald@eagle.fr',
    avatarUrl: '/uploads/avatars/alexis_est_Chauve.jpeg',
    bio: 'Mon cranne brille et ammène un peu de lueur dans ce monde triste. ClapClap le pigeon',
    gender: Gender.male,
    nationality: 'Geneve',
    country: 'Switzerland',
    birthdate: new Date('1993-03-02'),
    name: 'Alexis',
    surname: 'Chauve',
    city: 'Geneva',
    isEmailVerified: true,
  },
];

// --- CUSTOM ROOMS ---
const CUSTOM_ROOMS = [
  {
    name: 'Bocal Partout, Justice Nulle Part',
    description:
      'Le refuge officiel de Vincent pour proposer des pauses café et des bières à toute heure.',
    visibility: Visibility.public,
  },
  {
    name: 'Sion vs Lausanne: Le Choc des Cultures',
    description:
      'Débats passionnés sur le meilleur vin, la fondue et la suprématie des Crocs.',
    visibility: Visibility.public,
  },
  {
    name: 'Starbucks VIP & Rap Anglais',
    description:
      'Lounge réservé aux célébrités locales et aux sessions de correction de prononciation.',
    visibility: Visibility.private,
  },
  {
    name: 'Théorie du complot: Ice Pack & CHUV',
    description:
      "Combien d'ice packs faut-il pour survivre au projet Transcendence ?",
    visibility: Visibility.public,
  },
  {
    name: 'Club secret de la Neb',
    description:
      'Comparatif rigoureux entre la Zepp, la Moonshine et la Sterling.',
    visibility: Visibility.private,
  },
  {
    name: 'Membres Anonymes du Bocal 42',
    description:
      'Pour ceux qui ont le Bocal dans le sang et Curl dans le cœur.',
    visibility: Visibility.public,
  },
];

// --- CUSTOM POLLS ---
type CustomPoll = {
  title: string;
  description: string;
  type: PollType;
  status: PollStatus;
  options: {
    text: string;
    sliderLeftLabel?: string;
    sliderRightLabel?: string;
  }[];
  endsAt: Date;
  isAnonymous: boolean;
  allowChangeVote: boolean;
  hashtags: string[];
};

const CUSTOM_POLLS: CustomPoll[] = [
  {
    title: 'Chez Xu ou chez Yin? KingfuPanda ?',
    description: 'Meilleurs restaus chinois de tout les temps',
    type: PollType.multiple_choice,
    status: PollStatus.active,
    options: [{ text: 'Chez Yin' }, { text: 'Chez Xu' }],
    endsAt: inDays(4),
    isAnonymous: false,
    allowChangeVote: false,
    hashtags: ['food', 'school42'],
  },
  {
    title: 'Valais ou Vaud?',
    description: 'Le vin, la fondue, la charcute qui gagne la médaille ?',
    type: PollType.single_choice,
    status: PollStatus.active,
    options: [{ text: 'Vaud' }, { text: 'Valais' }, { text: 'Genève ????' }],
    endsAt: inDays(3),
    isAnonymous: false,
    allowChangeVote: false,
    hashtags: ['valais', 'apero', 'food'],
  },
  {
    title: 'Clope ou claude?',
    description: 'Avec claude remote, la question ne se pose plus....',
    type: PollType.single_choice,
    status: PollStatus.active,
    options: [{ text: 'Clope' }, { text: 'Claude' }],
    endsAt: inDays(2),
    isAnonymous: false,
    allowChangeVote: false,
    hashtags: ['tech', 'ai', 'school42'],
  },
  {
    title: 'Quel bière est la meilleure à la Neb?',
    description: 'Sterling, la zepp, ou la moonshine?',
    type: PollType.multiple_choice,
    status: PollStatus.active,
    options: [
      { text: 'La Zepp' },
      { text: 'La Moonshine' },
      { text: 'La Sterling' },
    ],
    endsAt: inDays(5),
    isAnonymous: false,
    allowChangeVote: false,
    hashtags: ['apero'],
  },
  {
    title: 'Pieric as tech lead ?',
    description: 'plutot pour ou plutot contre ?',
    type: PollType.slider,
    status: PollStatus.active,
    options: [
      {
        text: 'scale',
        sliderLeftLabel: 'Contre (0)',
        sliderRightLabel: 'Pour (10)',
      },
    ],
    endsAt: inDays(7),
    isAnonymous: false,
    allowChangeVote: false,
    hashtags: ['tech', 'school42'],
  },
  {
    title: 'Vidy ou Ouchy?',
    description: 'Choisis ton plus bel endroit pour voir le lac de genève',
    type: PollType.multiple_choice,
    status: PollStatus.closed,
    options: [{ text: 'Vidy' }, { text: 'Ouchy' }],
    endsAt: daysAgo(1),
    isAnonymous: false,
    allowChangeVote: false,
    hashtags: ['travel', 'sport'],
  },
  {
    title: 'API public ou front?',
    description: 'Les vrais dev utilisent curl ;-)',
    type: PollType.single_choice,
    status: PollStatus.active,
    options: [
      { text: 'front' },
      { text: 'le front ?' },
      { text: "c'est le front" },
      { text: 'que le front' },
      { text: 'fuck l API' },
    ],
    endsAt: inDays(4),
    isAnonymous: false,
    allowChangeVote: false,
    hashtags: ['tech', 'memes'],
  },
  {
    title: 'Jojo doit elle avoir un lapin ?',
    description: 'Réponse sérieuse demandée pour l appartement.',
    type: PollType.single_choice,
    status: PollStatus.active,
    options: [{ text: 'Oui' }, { text: 'Non' }],
    endsAt: inDays(6),
    isAnonymous: false,
    allowChangeVote: false,
    hashtags: ['memes'],
  },
  {
    title: 'Hygie as-t-elle fait le tic tac toe?',
    description: 'On ne saura jamais...',
    type: PollType.single_choice,
    status: PollStatus.closed,
    options: [{ text: 'non' }, { text: 'non' }, { text: 'un jour ?' }],
    endsAt: daysAgo(2),
    isAnonymous: false,
    allowChangeVote: false,
    hashtags: ['school42', 'tech'],
  },
  {
    title: 'Vincent vas t il prendre une bière ou un verre de vin ?',
    description: "En tout cas ce sera de l'alcool",
    type: PollType.single_choice,
    status: PollStatus.active,
    options: [{ text: 'vin' }, { text: 'bière' }, { text: 'les deux' }],
    endsAt: inDays(1),
    isAnonymous: false,
    allowChangeVote: false,
    hashtags: ['apero', 'valais'],
  },
  {
    title: "Combien d'ice pack est-ce que jojo a?",
    description: 'Un compagnon fidel? ou une armée de compagnons?',
    type: PollType.multiple_choice,
    status: PollStatus.active,
    options: [
      { text: 'Un seul' },
      { text: 'Deux' },
      { text: 'Trois en rotation' },
    ],
    endsAt: inDays(4),
    isAnonymous: false,
    allowChangeVote: true,
    hashtags: ['health', 'memes'],
  },
  {
    title: 'Bocal? pour ou contre',
    description: 'bocal partour justice nulle part',
    type: PollType.slider,
    status: PollStatus.active,
    options: [
      {
        text: 'scale',
        sliderLeftLabel: 'Nulle part (0)',
        sliderRightLabel: 'Partout (10)',
      },
    ],
    endsAt: inDays(10),
    isAnonymous: false,
    allowChangeVote: true,
    hashtags: ['bocal', 'school42'],
  },
  {
    title:
      'Combien de fois jojo est-elle allée aux urgences pendant le transcendence?',
    description: 'abonnement claude ou abonnement chuv ?',
    type: PollType.single_choice,
    status: PollStatus.closed,
    options: [
      { text: '1' },
      { text: '2' },
      { text: '3' },
      { text: '4' },
      { text: '5' },
    ],
    endsAt: daysAgo(3),
    isAnonymous: false,
    allowChangeVote: true,
    hashtags: ['health', 'school42'],
  },
  {
    title: 'Quel est le meilleur chien ?',
    description: "C'est méchant mais c est important",
    type: PollType.multiple_choice,
    status: PollStatus.active,
    options: [{ text: 'Wilma' }, { text: 'Poupou' }, { text: 'Aicka' }],
    endsAt: inDays(8),
    isAnonymous: false,
    allowChangeVote: true,
    hashtags: ['memes'],
  },
  {
    title: '42 ou HES?',
    description: 'Le grand débat de l éducation suisse',
    type: PollType.single_choice,
    status: PollStatus.active,
    options: [{ text: 'HEC' }, { text: 'EPFL' }],
    endsAt: inDays(5),
    isAnonymous: false,
    allowChangeVote: true,
    hashtags: ['school42', 'tech', 'science'],
  },
  {
    title: 'Claude ou Chatty',
    description: 'qui qui est le plus sympa',
    type: PollType.single_choice,
    status: PollStatus.active,
    options: [{ text: 'Chattos' }, { text: 'CloClo' }],
    endsAt: inDays(3),
    isAnonymous: false,
    allowChangeVote: true,
    hashtags: ['ai', 'tech'],
  },
];

function hashPassword(plain: string, pepper: string): Promise<string> {
  return hash(plain, {
    hashLength: 32,
    timeCost: 3,
    parallelism: 4,
    memoryCost: 2 ** 16,
    type: argon2id,
    secret: Buffer.from(pepper),
  });
}

function buildProfile() {
  const country = faker.location.country();
  const lastSeenAt = faker.helpers.maybe(
    () => faker.date.recent({ days: 30 }),
    { probability: 0.8 },
  );

  return {
    name: faker.person.firstName(),
    surname: faker.person.lastName(),
    nationality: country,
    country,
    city: faker.location.city(),
    state: faker.location.state(),
    company:
      faker.helpers.maybe(() => faker.company.name(), {
        probability: COMPANY_PROBABILITY,
      }) ?? null,
    bio:
      faker.helpers.maybe(() => faker.person.bio().slice(0, 255), {
        probability: BIO_PROBABILITY,
      }) ?? null,
    isEmailVerified: faker.datatype.boolean({
      probability: VERIFIED_PROBABILITY,
    }),
    visibility: faker.datatype.boolean({
      probability: PRIVATE_PROFILE_PROBABILITY,
    })
      ? Visibility.private
      : Visibility.public,
    lastSeenAt: lastSeenAt ?? null,
  };
}

function buildCrewProfile(
  name: string,
  surname: string,
  place: { nationality: string; country: string; state: string; city: string },
) {
  return {
    name,
    surname,
    ...place,
    company: 'Pollpear',
    bio: faker.person.bio().slice(0, 255),
    isEmailVerified: true,
    visibility: Visibility.public,
    lastSeenAt: faker.date.recent({ days: 3 }),
  };
}

function buildJojo(i: number, passwordHash: string): Prisma.UserCreateInput {
  return {
    username: 'jojo' + i,
    email: 'jojo' + i + '@pollpear.com',
    birthdate: new Date('1998-12-01'),
    passwordHash,
    createdAt: accountCreatedAt(),
    role: UserRole.admin,
    gender: Gender.female,
    userTheme: UserTheme.dark,
    ...buildCrewProfile('Joanne', 'Murphy', {
      nationality: 'Irish',
      country: 'Ireland',
      state: 'Leinster',
      city: 'Dublin',
    }),
  };
}

function buildHygie(i: number, passwordHash: string): Prisma.UserCreateInput {
  return {
    username: 'hygie' + i,
    email: 'hygie' + i + '@pollpear.com',
    birthdate: new Date('1990-01-01'),
    passwordHash,
    createdAt: accountCreatedAt(),
    role: UserRole.admin,
    gender: Gender.female,
    userTheme: UserTheme.dark,
    ...buildCrewProfile('Hygie', 'Bernard', {
      nationality: 'Swiss',
      country: 'Switzerland',
      state: 'Zürich',
      city: 'Zürich',
    }),
  };
}

function buildPieric(i: number, passwordHash: string): Prisma.UserCreateInput {
  return {
    username: 'pieric' + i,
    email: 'pieric' + i + '@pollpear.com',
    birthdate: new Date('1990-01-01'),
    passwordHash,
    createdAt: accountCreatedAt(),
    role: UserRole.admin,
    gender: Gender.other,
    userTheme: UserTheme.dark,
    ...buildCrewProfile('Pieric', 'Emonet', {
      nationality: 'Swiss',
      country: 'Switzerland',
      state: 'Valais',
      city: 'Sion',
    }),
  };
}

function buildRaph(i: number, passwordHash: string): Prisma.UserCreateInput {
  return {
    username: 'raph' + i,
    email: 'raph' + i + '@pollpear.com',
    birthdate: new Date('1990-01-01'),
    passwordHash,
    createdAt: accountCreatedAt(),
    role: UserRole.admin,
    gender: Gender.other,
    userTheme: UserTheme.dark,
    ...buildCrewProfile('Raphaël', 'Stoll', {
      nationality: 'Swiss',
      country: 'Switzerland',
      state: 'Genève',
      city: 'Genève',
    }),
  };
}

function buildUser(i: number, passwordHash: string): Prisma.UserCreateInput {
  return {
    username: 'user' + i,
    email: 'user' + i + '@pollpear.com',
    birthdate: faker.date.birthdate({ min: 18, max: 90, mode: 'age' }),
    passwordHash,
    createdAt: accountCreatedAt(),
    role: UserRole.user,
    gender: faker.helpers.arrayElement([
      Gender.male,
      Gender.female,
      Gender.other,
      Gender.prefer_not_to_say,
    ]),
    ...buildProfile(),
    userTheme: faker.helpers.arrayElement([
      UserTheme.light,
      UserTheme.dark,
      UserTheme.system,
      UserTheme.other,
    ]),
  };
}

function buildModerator(
  i: number,
  passwordHash: string,
): Prisma.UserCreateInput {
  return {
    username: 'moderator' + i,
    email: 'moderator' + i + '@pollpear.com',
    birthdate: faker.date.birthdate({ min: 18, max: 90, mode: 'age' }),
    passwordHash,
    createdAt: accountCreatedAt(),
    role: UserRole.moderator,
    gender: faker.helpers.arrayElement([
      Gender.male,
      Gender.female,
      Gender.other,
      Gender.prefer_not_to_say,
    ]),
    ...buildProfile(),
    isEmailVerified: true,
    userTheme: faker.helpers.arrayElement([
      UserTheme.light,
      UserTheme.dark,
      UserTheme.system,
      UserTheme.other,
    ]),
  };
}

function buildRoom(
  i: number,
  creatorId: number,
  plan?: { members: CrewName[]; visibility: Visibility },
): Prisma.RoomCreateInput {
  const status = plan
    ? RoomStatus.active
    : faker.helpers.arrayElement([RoomStatus.active, RoomStatus.closed]);

  const createdAt = faker.date.past({ years: 1 });

  return {
    name: 'room' + i,
    description: faker.lorem.sentence(),
    bannerUrl: '/uploads/banners/default.svg',
    visibility:
      plan?.visibility ??
      faker.helpers.arrayElement([Visibility.public, Visibility.private]),
    status,
    createdAt,
    createdBy: { connect: { id: creatorId } },
  };
}

function buildConversation(
  roomId: number,
  members: { userId: number; joinedAt: Date }[],
  count: number,
  from: Date,
): Prisma.MessageCreateManyInput[] {
  const start = from.getTime();
  const span = Math.max(now.getTime() - start, DAY_MS);

  return Array.from({ length: count }, (_, i) => {
    const at = new Date(
      Math.min(
        start +
          Math.round((span * (i + 1)) / (count + 1)) +
          faker.number.int({ min: 0, max: 60_000 }),
        now.getTime(),
      ),
    );
    const spoken = members.filter((member) => member.joinedAt <= at);
    const author = faker.helpers.arrayElement(
      spoken.length > 0 ? spoken : members,
    );

    return {
      roomId,
      authorId: author.userId,
      content: faker.lorem.sentence({ min: 3, max: 20 }),
      createdAt: at,
    };
  });
}

function buildOptionRows(
  type: PollType,
): Prisma.OptionCreateWithoutPollInput[] {
  if (type === PollType.slider) {
    return [
      {
        text: 'scale',
        order: 0,
        sliderLeftLabel: String(SLIDER_MIN),
        sliderRightLabel: String(SLIDER_MAX),
      },
    ];
  }
  if (type === PollType.free_field) {
    return [{ text: 'free_text_answer', order: 0 }];
  }
  const count =
    type === PollType.single_choice
      ? faker.number.int({ min: 2, max: 5 })
      : faker.number.int({ min: 3, max: 6 });
  return Array.from({ length: count }, (_, order) => ({
    text: faker.lorem.words({ min: 1, max: 3 }),
    order,
  }));
}

function buildPollTimes(
  status: PollStatus,
  room: { createdAt: Date } | null,
): { createdAt: Date; publishedAt: Date; endsAt: Date } {
  const publishedAt = room
    ? faker.date.between({ from: room.createdAt, to: now })
    : faker.date.past({ years: 1 });
  const createdAt = room
    ? faker.date.between({
        from: new Date(
          Math.max(
            publishedAt.getTime() - 5 * DAY_MS,
            room.createdAt.getTime(),
          ),
        ),
        to: publishedAt,
      })
    : faker.date.recent({ days: 5, refDate: publishedAt });
  const endsAt =
    status === PollStatus.active
      ? faker.date.future({ years: 1, refDate: now })
      : faker.date.between({ from: publishedAt, to: now });
  return { createdAt, publishedAt, endsAt };
}

function pickVoteOptions(
  type: PollType,
  liveOptions: { id: number }[],
  voterIndex: number,
  leaderId: number,
): { optionIds: number[]; freeField: string | null } {
  if (type === PollType.slider) {
    const value = Math.round(
      (faker.number.int({ min: SLIDER_MIN, max: SLIDER_MAX }) +
        faker.number.int({ min: SLIDER_MIN, max: SLIDER_MAX })) /
        2,
    );
    return { optionIds: [liveOptions[0].id], freeField: String(value) };
  }
  if (type === PollType.free_field) {
    return {
      optionIds: [liveOptions[0].id],
      freeField: faker.lorem.paragraph().slice(0, 255),
    };
  }
  if (type === PollType.single_choice) {
    const leader = liveOptions.find((o) => o.id === leaderId) ?? liveOptions[0];
    const chosen =
      voterIndex < liveOptions.length
        ? liveOptions[voterIndex]
        : faker.helpers.arrayElement([leader, ...liveOptions]);
    return { optionIds: [chosen.id], freeField: null };
  }
  const subset = faker.helpers.arrayElements(
    liveOptions,
    faker.number.int({ min: 1, max: Math.min(3, liveOptions.length) }),
  );
  if (
    voterIndex < liveOptions.length &&
    !subset.some((o) => o.id === liveOptions[voterIndex].id)
  ) {
    subset[0] = liveOptions[voterIndex];
  }
  return { optionIds: subset.map((o) => o.id), freeField: null };
}

function buildApiAccount(
  username: string,
  role: UserRole,
  passwordHash: string,
): Prisma.UserCreateInput {
  return {
    username,
    email: username + '@pollpear.com',
    birthdate: new Date('1990-01-01'),
    passwordHash,
    createdAt: accountCreatedAt(),
    role,
    gender: Gender.prefer_not_to_say,
    userTheme: UserTheme.dark,
    ...buildProfile(),
    nationality: 'Switzerland',
    country: 'Switzerland',
    state: 'Genève',
    city: 'Genève',
    isEmailVerified: true,
    visibility: Visibility.public,
  };
}

async function seedApiAccounts(passwordHash: string): Promise<IssuedKey[]> {
  const issued: IssuedKey[] = [];

  for (const { username, role } of API_ACCOUNTS) {
    const user = await prisma.user.create({
      data: buildApiAccount(username, role, passwordHash),
    });
    const { key, keyHash } = generateApiKey();
    const expiredAt = expiryFromTtl(API_KEY_LIFETIME_SECONDS);

    await prisma.apiKey.create({
      data: { keyHash, appName: 'api-roles', ownerId: user.id, expiredAt },
    });

    issued.push({ role, username, key, keyHash, ownerId: user.id, expiredAt });
  }

  return issued;
}

async function pushKeysToRedis(issued: IssuedKey[]): Promise<number> {
  const redis = new Redis({
    host: vault.redis.host,
    port: Number(vault.redis.port),
    password: vault.redis.password,
  });

  try {
    for (const { keyHash, ownerId, expiredAt } of issued) {
      const ttl = remainingSeconds(expiredAt);
      await redis.set(apiKeyCacheKey(keyHash), ownerId, 'EX', ttl);
    }
    return issued.length;
  } finally {
    await redis.quit();
  }
}

function reportApiAccounts(issued: IssuedKey[]) {
  console.log(`\nAPI test accounts, password ${DEFAULT_PASSWORD}:`);
  for (const { role, username, key } of issued) {
    console.log(`  ${role.padEnd(10)} ${username.padEnd(13)} ${key}`);
  }
  console.log('\nFeed them to scripts/api-roles.sh to compare a route.');
}

async function main() {
  await vault.init();
  const adapter = new PrismaPg({ connectionString: vault.db.database_url });
  prisma = new PrismaClient({ adapter });

  const passwordHash = await hashPassword(
    DEFAULT_PASSWORD,
    vault.session.pepper,
  );

  const jojo = await prisma.user.create({ data: buildJojo(0, passwordHash) });
  const hygie = await prisma.user.create({
    data: buildHygie(1, passwordHash),
  });
  const pieric = await prisma.user.create({
    data: buildPieric(2, passwordHash),
  });
  const raph = await prisma.user.create({ data: buildRaph(3, passwordHash) });
  const crewIds: Record<CrewName, number> = {
    jojo: jojo.id,
    hygie: hygie.id,
    pieric: pieric.id,
    raph: raph.id,
  };
  await prisma.user.create({ data: buildModerator(4, passwordHash) });
  await prisma.user.create({ data: buildUser(5, passwordHash) });

  // Custom Users Creation
  const customUserEntities: Record<string, number> = {};
  for (const u of CUSTOM_USERS) {
    const createdUser = await prisma.user.create({
      data: {
        ...u,
        passwordHash,
        createdAt: accountCreatedAt(),
        role: UserRole.user,
        userTheme: UserTheme.dark,
        visibility: Visibility.public,
        state: 'Vaud',
      },
    });
    customUserEntities[u.username] = createdUser.id;
  }

  for (let i = 6 + CUSTOM_USERS.length; i < USER_COUNT; i++) {
    await prisma.user.create({ data: buildUser(i, passwordHash) });
  }
  const issuedKeys = await seedApiAccounts(passwordHash);
  console.log(
    `Done — ${USER_COUNT} users seeded, plus ${API_ACCOUNTS.length} api ones.`,
  );

  const userIds = (await prisma.user.findMany({ select: { id: true } })).map(
    (u) => u.id,
  );

  // --- SEEDING BLOCKED USERS (BLOCK) ---
  const blocksToCreate = [
    {
      blockerId: customUserEntities['Jojo_du_38'],
      blockedId: customUserEntities['GhostVincent'],
    },
    {
      blockerId: customUserEntities['P2monts'],
      blockedId: customUserEntities['MasterclassBen'],
    },
    {
      blockerId: customUserEntities['GhostVincent'],
      blockedId: customUserEntities['Miguel'],
    },
  ];

  for (const blockItem of blocksToCreate) {
    if (blockItem.blockerId && blockItem.blockedId) {
      await prisma.block.create({
        data: {
          blockerId: blockItem.blockerId,
          blockedId: blockItem.blockedId,
          createdAt: faker.date.recent({ days: 60 }),
        },
      });
    }
  }
  console.log(`Done — ${blocksToCreate.length} user blocks created in Block.`);

  // --- ROOMS SEEDING ---
  const crewRoomMembers = new Map<number, number[]>();
  let everyoneRoomId = 0;
  const createdRoomIds: number[] = [];

  // 1. Crew Rooms
  for (let i = 0; i < CREW_ROOM_PLAN.length; i++) {
    const plan = CREW_ROOM_PLAN[i];
    const creatorId = crewIds[plan.members[0]];
    const room = await prisma.room.create({
      data: buildRoom(i, creatorId, plan),
    });
    if (i === 0) everyoneRoomId = room.id;
    crewRoomMembers.set(
      room.id,
      plan.members.map((member) => crewIds[member]),
    );
    createdRoomIds.push(room.id);
  }

  // 2. Custom Fun Rooms
  for (let i = 0; i < CUSTOM_ROOMS.length; i++) {
    const customRoom = CUSTOM_ROOMS[i];
    const creatorId = faker.helpers.arrayElement(
      Object.values(customUserEntities),
    );
    const room = await prisma.room.create({
      data: {
        name: customRoom.name,
        description: customRoom.description,
        bannerUrl: '/uploads/banners/default.svg',
        visibility: customRoom.visibility,
        status: RoomStatus.active,
        createdAt: faker.date.past({ years: 1 }),
        createdBy: { connect: { id: creatorId } },
      },
    });
    createdRoomIds.push(room.id);
  }

  // 3. Random Generated Rooms
  const remainingRooms = ROOM_COUNT - createdRoomIds.length;
  for (let i = 0; i < remainingRooms; i++) {
    const creatorId = faker.helpers.arrayElement(userIds);
    const room = await prisma.room.create({
      data: buildRoom(i + 100, creatorId),
    });
    createdRoomIds.push(room.id);
  }

  console.log(
    `Done — ${createdRoomIds.length} rooms seeded (including custom fun rooms).`,
  );

  const bump = (m: Map<number, number>, id: number) =>
    m.set(id, (m.get(id) ?? 0) + 1);
  const votesCast = new Map<number, number>();
  const roomsJoined = new Map<number, number>();
  const pollsCreated = new Map<number, number>();

  const rooms = await prisma.room.findMany({
    select: {
      id: true,
      status: true,
      visibility: true,
      createdById: true,
      createdAt: true,
    },
  });

  // --- HASHTAGS SEEDING ---
  const hashtagIds = new Map<string, number>();
  for (const name of HASHTAG_NAMES) {
    const hashtag = await prisma.hashtag.create({
      data: {
        name,
        deletedAt: HIDDEN_HASHTAGS.has(name) ? new Date() : null,
      },
    });
    hashtagIds.set(name, hashtag.id);
  }

  // --- ROOM MEMBERS ---
  const roomMembers = new Map<number, { userId: number; joinedAt: Date }[]>();
  const roomMemberRows: { roomId: number; userId: number; joinedAt: Date }[] =
    [];
  for (const room of rooms) {
    const base = room.createdAt;
    const members = [{ userId: room.createdById, joinedAt: base }];
    for (const crewId of crewRoomMembers.get(room.id) ?? []) {
      if (members.some((member) => member.userId === crewId)) continue;
      members.push({
        userId: crewId,
        joinedAt: faker.date.between({ from: base, to: now }),
      });
    }
    const seated = new Set(members.map((member) => member.userId));
    const pool = userIds.filter((id) => !seated.has(id));
    const extraCount =
      room.id === everyoneRoomId
        ? pool.length
        : crewRoomMembers.has(room.id)
          ? 0
          : Math.min(
              faker.number.int({ min: MEMBERS_MIN, max: MEMBERS_MAX }),
              pool.length,
            );
    for (const uid of faker.helpers.arrayElements(pool, extraCount)) {
      members.push({
        userId: uid,
        joinedAt: faker.date.between({ from: base, to: now }),
      });
    }
    members.sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    roomMembers.set(room.id, members);
    for (const member of members) {
      roomMemberRows.push({
        roomId: room.id,
        userId: member.userId,
        joinedAt: member.joinedAt,
      });
      bump(roomsJoined, member.userId);
    }
  }
  await prisma.roomMember.createMany({ data: roomMemberRows });

  // --- MESSAGES ---
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const crewRoomIds = [...crewRoomMembers.keys()];
  const chattyRoomIds = [
    ...crewRoomIds,
    ...faker.helpers.arrayElements(
      rooms.filter((room) => !crewRoomMembers.has(room.id)).map((r) => r.id),
      CHATTY_ROOM_COUNT,
    ),
  ];
  const messageRows: Prisma.MessageCreateManyInput[] = [];
  for (const roomId of chattyRoomIds) {
    const members = roomMembers.get(roomId) ?? [];
    if (members.length === 0) continue;
    const count =
      roomId === crewRoomIds[0]
        ? BUSY_ROOM_MESSAGES
        : faker.number.int({ min: ROOM_MESSAGES_MIN, max: ROOM_MESSAGES_MAX });
    messageRows.push(
      ...buildConversation(
        roomId,
        members,
        count,
        roomById.get(roomId)!.createdAt,
      ),
    );
  }
  for (const row of faker.helpers.arrayElements(
    messageRows,
    Math.min(DELETED_MESSAGE_DEMO, messageRows.length),
  )) {
    row.deletedAt = faker.date.between({ from: row.createdAt!, to: now });
  }
  await prisma.message.createMany({ data: messageRows });
  console.log(
    `Done — ${messageRows.length} messages seeded across ${chattyRoomIds.length} rooms.`,
  );

  // --- FRIENDSHIPS ---
  const friendshipStatuses = faker.helpers.shuffle(FRIENDSHIP_STATUS_PLAN);
  const usedPairs = new Set<string>();
  const friendshipRows: {
    status: FriendshipStatus;
    userAId: number;
    userBId: number;
    addresseeId: number;
  }[] = [];
  while (friendshipRows.length < friendshipStatuses.length) {
    const [a, b] = faker.helpers.arrayElements(userIds, 2);
    const pair = canonicalPair(a, b);
    const key = `${pair.userAId}-${pair.userBId}`;
    if (usedPairs.has(key)) continue;
    usedPairs.add(key);
    friendshipRows.push({
      status: friendshipStatuses[friendshipRows.length],
      ...pair,
      addresseeId: faker.datatype.boolean() ? pair.userAId : pair.userBId,
    });
  }
  await prisma.friendship.createMany({ data: friendshipRows });

  const jojoRequesters = await prisma.user.findMany({
    where: {
      id: {
        not: jojo.id,
        in: userIds.filter(
          (id) =>
            id !== jojo.id &&
            !usedPairs.has(`${Math.min(id, jojo.id)}-${Math.max(id, jojo.id)}`),
        ),
      },
    },
    select: { id: true, username: true },
    take: JOJO_PENDING_REQUESTS,
  });
  await prisma.friendship.createMany({
    data: jojoRequesters.map((requester) => ({
      status: FriendshipStatus.pending,
      ...canonicalPair(requester.id, jojo.id),
      addresseeId: jojo.id,
    })),
  });
  await prisma.notification.createMany({
    data: jojoRequesters.map((requester) => ({
      type: NotificationType.friend_request,
      content: `${requester.username} sent you a friend request.`,
      userId: jojo.id,
      actorId: requester.id,
    })),
  });
  console.log(
    `Done — ${jojoRequesters.length} pending friend requests seeded for jojo0.`,
  );

  // --- POLLS SEEDING ---
  const pollTypes = faker.helpers.shuffle(POLL_TYPE_PLAN);
  const pollStatuses = faker.helpers.shuffle(POLL_STATUS_PLAN);
  const activeRooms = rooms.filter((r) => r.status === RoomStatus.active);
  const pollRecords: {
    id: number;
    type: PollType;
    status: PollStatus;
    publishedAt: Date | null;
    endsAt: Date;
    roomId: number | null;
    visibility: Visibility;
    createdById: number;
    options: { id: number; deletedAt: Date | null }[];
  }[] = [];

  const pollHashtagRows: { pollId: number; hashtagId: number }[] = [];
  let roomCursor = 0;
  let deletedDemoLeft = 2;

  // Every other generated poll lands in a room, so the feed keeps a mix of
  // room scoped and public polls on top of the hand written ones below.
  for (let i = 0; i < pollTypes.length; i++) {
    const type = pollTypes[i];
    const status = pollStatuses[i];
    const room =
      activeRooms.length > 0 && i % 2 === 0
        ? activeRooms[roomCursor++ % activeRooms.length]
        : null;
    const visibility = room ? room.visibility : Visibility.public;
    const createdById = room
      ? faker.helpers.arrayElement(roomMembers.get(room.id)!).userId
      : faker.helpers.arrayElement(userIds);

    const { createdAt, publishedAt, endsAt } = buildPollTimes(status, room);
    const optionRows = buildOptionRows(type);
    if (
      deletedDemoLeft > 0 &&
      (type === PollType.single_choice || type === PollType.multiple_choice)
    ) {
      optionRows.push({
        text: '[deleted option]',
        order: optionRows.length,
        deletedAt: new Date(),
      });
      deletedDemoLeft--;
    }

    const poll = await prisma.poll.create({
      data: {
        title: faker.lorem.sentence().replace(/\.$/, '?'),
        description: faker.datatype.boolean() ? faker.lorem.sentence() : null,
        type,
        status,
        visibility,
        isAnonymous: faker.datatype.boolean(),
        allowChangeVote: faker.datatype.boolean(),
        createdAt,
        publishedAt,
        endsAt,
        createdBy: { connect: { id: createdById } },
        ...(room ? { room: { connect: { id: room.id } } } : {}),
        options: { create: optionRows },
      },
      include: { options: true },
    });
    bump(pollsCreated, createdById);
    pollRecords.push({
      id: poll.id,
      type,
      status,
      publishedAt,
      endsAt,
      roomId: room?.id ?? null,
      visibility,
      createdById,
      options: poll.options.map((o) => ({ id: o.id, deletedAt: o.deletedAt })),
    });
  }

  // The generated polls get a random spread of tags; the custom ones carry
  // their own list, so they are tagged as they are created just below.
  for (const poll of pollRecords) {
    const isPublic = poll.visibility === Visibility.public;
    if (!isPublic && !faker.datatype.boolean()) continue;
    const names = faker.helpers.arrayElements(
      HASHTAG_NAMES,
      isPublic ? faker.number.int({ min: 1, max: 3 }) : 1,
    );
    for (const name of names) {
      pollHashtagRows.push({
        pollId: poll.id,
        hashtagId: hashtagIds.get(name)!,
      });
    }
  }

  const generatedPollCount = pollRecords.length;

  // --- CUSTOM POLLS ---
  for (let i = 0; i < CUSTOM_POLLS.length; i++) {
    const cp = CUSTOM_POLLS[i];
    const createdById = faker.helpers.arrayElement(userIds);
    // A closed poll has to have been published before it ended, otherwise the
    // vote window further down is empty and faker refuses to date the votes.
    const publishedAt =
      cp.status === PollStatus.closed
        ? faker.date.between({ from: daysAgo(30), to: cp.endsAt })
        : faker.date.recent({ days: 10 });
    const createdAt = publishedAt;

    const poll = await prisma.poll.create({
      data: {
        title: cp.title,
        description: cp.description,
        type: cp.type,
        status: cp.status,
        visibility: Visibility.public,
        isAnonymous: cp.isAnonymous,
        allowChangeVote: cp.allowChangeVote,
        createdAt,
        publishedAt,
        endsAt: cp.endsAt,
        createdById,
        options: {
          create: cp.options.map((opt, order) => ({
            text: opt.text,
            sliderLeftLabel: opt.sliderLeftLabel ?? null,
            sliderRightLabel: opt.sliderRightLabel ?? null,
            order,
          })),
        },
      },
      include: { options: true },
    });

    bump(pollsCreated, createdById);

    for (const tag of cp.hashtags) {
      const hid = hashtagIds.get(tag);
      if (hid) pollHashtagRows.push({ pollId: poll.id, hashtagId: hid });
    }

    pollRecords.push({
      id: poll.id,
      type: poll.type,
      status: poll.status,
      publishedAt: poll.publishedAt,
      endsAt: poll.endsAt,
      roomId: poll.roomId,
      visibility: poll.visibility,
      createdById: poll.createdById,
      options: poll.options.map((o) => ({ id: o.id, deletedAt: o.deletedAt })),
    });
  }

  if (pollHashtagRows.length > 0) {
    await prisma.pollHashtag.createMany({ data: pollHashtagRows });
  }
  console.log(
    `Done — ${pollRecords.length} polls seeded (${generatedPollCount} generated, ${CUSTOM_POLLS.length} hand written).`,
  );

  // --- VOTES SEEDING ---
  const hotPollIds = new Set(
    faker.helpers.arrayElements(
      pollRecords.map((poll) => poll.id),
      Math.min(HOT_POLL_COUNT, pollRecords.length),
    ),
  );
  const voteRows: {
    pollId: number;
    createdById: number;
    freeField: string | null;
    createdAt: Date;
  }[] = [];
  // A vote is unique per (voter, poll), so that pair keys the picked options
  // until createManyAndReturn hands back the generated vote ids.
  const pickedOptionIds = new Map<string, number[]>();

  for (const poll of pollRecords) {
    if (!poll.publishedAt) continue;
    const liveOptions = poll.options.filter((o) => !o.deletedAt);
    if (liveOptions.length === 0) continue;

    // A room poll is only answerable by its members, and only from the day
    // they joined; a public one is open to everybody but its own author.
    const eligible: { userId: number; joinedAt: Date | null }[] =
      poll.roomId !== null
        ? (roomMembers.get(poll.roomId) ?? []).filter(
            (m) => m.userId !== poll.createdById && m.joinedAt <= poll.endsAt,
          )
        : userIds
            .filter((id) => id !== poll.createdById)
            .map((id) => ({ userId: id, joinedAt: null }));
    if (eligible.length === 0) continue;

    const voters = faker.helpers.arrayElements(
      eligible,
      hotPollIds.has(poll.id)
        ? eligible.length
        : faker.number.int({ min: 1, max: eligible.length }),
    );
    const leaderId = faker.helpers.arrayElement(liveOptions).id;
    const windowEnd = new Date(Math.min(poll.endsAt.getTime(), now.getTime()));

    for (let index = 0; index < voters.length; index++) {
      const voter = voters[index];
      const { optionIds, freeField } = pickVoteOptions(
        poll.type,
        liveOptions,
        index,
        leaderId,
      );
      const from = new Date(
        Math.max(poll.publishedAt.getTime(), voter.joinedAt?.getTime() ?? 0),
      );

      voteRows.push({
        pollId: poll.id,
        createdById: voter.userId,
        freeField,
        createdAt: faker.date.between({ from, to: windowEnd }),
      });
      pickedOptionIds.set(`${voter.userId}:${poll.id}`, optionIds);
      bump(votesCast, voter.userId);
    }
  }

  const createdVotes = await prisma.vote.createManyAndReturn({
    data: voteRows,
    select: { id: true, createdById: true, pollId: true },
  });

  const voteOptionRows = createdVotes.flatMap((vote) =>
    (pickedOptionIds.get(`${vote.createdById}:${vote.pollId}`) ?? []).map(
      (optionId) => ({ voteId: vote.id, optionId }),
    ),
  );

  if (voteOptionRows.length > 0) {
    await prisma.voteOption.createMany({ data: voteOptionRows });
  }
  console.log(
    `Done — ${createdVotes.length} votes / ${voteOptionRows.length} picked options seeded.`,
  );

  // --- SCORES COMPUTATION ---
  for (const uid of userIds) {
    const vCount = votesCast.get(uid) ?? 0;
    const rCount = roomsJoined.get(uid) ?? 0;
    const pCount = pollsCreated.get(uid) ?? 0;
    const totalScore =
      vCount * SCORE_PER_VOTE +
      rCount * SCORE_PER_ROOM +
      pCount * SCORE_PER_POLL;

    await prisma.user.update({
      where: { id: uid },
      data: { score: totalScore },
    });
  }
  console.log(`Done — user scores updated.`);

  try {
    const keysPushed = await pushKeysToRedis(issuedKeys);
    console.log(`Done — ${keysPushed} API keys seeded into Redis.`);
  } catch (error) {
    console.error(`Could not load the keys into redis: ${String(error)}`);
    console.error('Restart the backend to have it restore them.');
  }
  reportApiAccounts(issuedKeys);

  console.log('\nSeeding process finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });
