/**
 * Seeds the blog tables with the initial categories and articles.
 *
 * Usage:  pnpm blog:seed   (after pnpm db:generate && pnpm db:migrate)
 *
 * i18n-ready: machine-readable data (slugs, dates, URLs, positions) goes
 * on parent rows, human-readable text goes in `fr` translation rows —
 * see server/database/schema/blog.ts.
 *
 * The script is re-runnable:
 * - categories are upserted by slug (never deleted: articles reference them),
 * - an article whose slug already exists is replaced (its translations,
 *   sections and media follow through ON DELETE CASCADE).
 * Image URLs are placeholders — swap them for the real third-party
 * cloud URLs directly in the database or in this file.
 */
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db } from '../server/database'
import {
  blogCategories,
  blogCategoryTranslations,
  blogArticles,
  blogArticleTranslations,
  blogArticleSections,
  blogArticleMedia,
} from '../server/database/schema/blog'
import { DEFAULT_LOCALE } from '../shared/types/locale'

interface SeedCategory {
  /** URL segment, referenced by articles below. */
  slug: string
  /** MDI icon — must be registered in app/utils/mdi-icons.ts (see the comment there). */
  icon: string
  /** Display order in the filter bar (0 = first). */
  position: number
  /** Translated display name (fr in v1). */
  name: string
}

interface SeedArticle {
  slug: string
  /** Category slug — resolved to its DB id at insert time. */
  category: string
  publishedAt: string
  readingMinutes: number
  lines: string[]
  nearestStop: string
  heroImageUrl: string
  // Translated fields (fr in v1) — written to blog_article_translations.
  title: string
  excerpt: string
  outroTitle: string
  outroText: string
  sections: { title: string, body: string }[]
  gallery: { type: 'image' | 'youtube', src: string, alt?: string }[]
}

/** Stable placeholder image URL (same seed → same photo). */
function img(seed: string): string {
  return `https://picsum.photos/seed/${seed}/1200/675`
}

/** Builds the 3 default gallery images of an article. */
function imageGallery(slug: string, alt: string): SeedArticle['gallery'] {
  return [
    { type: 'image', src: img(`${slug}-1`), alt: `${alt} — vue 1` },
    { type: 'image', src: img(`${slug}-2`), alt: `${alt} — vue 2` },
    { type: 'image', src: img(`${slug}-3`), alt: `${alt} — vue 3` },
  ]
}

/** Demo YouTube video ID — replace with a real video of the place. */
const DEMO_YOUTUBE_ID = 'M7lc1UVf-VE'

const SEED_CATEGORIES: SeedCategory[] = [
  { slug: 'bus-et-tram', icon: 'mdi-tram', position: 0, name: 'Bus & Tram' },
  { slug: 'musees', icon: 'mdi-bank', position: 1, name: 'Musées' },
  { slug: 'bibliotheques', icon: 'mdi-library-outline', position: 2, name: 'Bibliothèques' },
  { slug: 'lieux-historiques', icon: 'mdi-church', position: 3, name: 'Lieux historiques' },
  { slug: 'lieux-populaires', icon: 'mdi-city-variant-outline', position: 4, name: 'Lieux populaires' },
]

const SEED_ARTICLES: SeedArticle[] = [
  {
    slug: 'homme-de-fer',
    title: 'Homme de Fer : le cœur battant du réseau tram',
    excerpt: 'Cinq lignes de tram se croisent sur cette place emblématique. Nos conseils pour changer de ligne sans stress aux heures de pointe.',
    category: 'bus-et-tram',
    publishedAt: '2026-07-10',
    readingMinutes: 4,
    lines: ['A', 'B', 'C', 'D', 'F'],
    nearestStop: 'Homme de Fer',
    heroImageUrl: img('homme-de-fer'),
    outroTitle: 'Y aller',
    outroText: 'Descendez à l’arrêt Homme de Fer, au croisement de toutes les lignes de tram du centre-ville. La place Kléber est à une minute à pied.',
    sections: [
      { title: 'Une correspondance record', body: 'Les lignes A, B, C, D et F se croisent ici toutes les deux à trois minutes en journée. Placez-vous au centre de la rotonde de verre pour repérer votre quai en un coup d’œil.' },
      { title: 'Nos astuces aux heures de pointe', body: 'Entre 7 h 30 et 9 h, préférez les portes arrière des rames et anticipez votre correspondance dès la descente. L’application vous indique les prochains passages en temps réel.' },
    ],
    gallery: imageGallery('homme-de-fer', 'Station Homme de Fer'),
  },
  {
    slug: 'gare-centrale',
    title: 'Gare Centrale : bien commencer son voyage',
    excerpt: 'De la verrière au souterrain tram, tout ce qu’il faut savoir pour passer du train au réseau urbain en quelques minutes.',
    category: 'bus-et-tram',
    publishedAt: '2026-06-28',
    readingMinutes: 5,
    lines: ['A', 'C', 'D'],
    nearestStop: 'Gare Centrale',
    heroImageUrl: img('gare-centrale'),
    outroTitle: 'Y aller',
    outroText: 'Arrêt Gare Centrale, lignes A, C et D. Comptez sept minutes de tram jusqu’à Homme de Fer.',
    sections: [
      { title: 'Du TGV au tram en cinq minutes', body: 'Depuis les quais SNCF, suivez la signalétique « Tram » : la station souterraine se trouve juste sous la place de la Gare. Les lignes A et D partent toutes les trois à six minutes.' },
      { title: 'La verrière, une étape en soi', body: 'La façade historique de 1883 est enveloppée d’une verrière spectaculaire. Prenez une minute pour l’admirer depuis le parvis avant de rejoindre le centre-ville.' },
    ],
    gallery: [...imageGallery('gare-centrale', 'Gare Centrale de Strasbourg'), { type: 'youtube', src: DEMO_YOUTUBE_ID }],
  },
  {
    slug: 'musee-alsacien',
    title: 'Le Musée Alsacien, un voyage dans le temps',
    excerpt: 'Arts et traditions populaires dans une maison à colombages du quai Saint-Nicolas. Une visite parfaite un jour de pluie.',
    category: 'musees',
    publishedAt: '2026-06-15',
    readingMinutes: 6,
    lines: ['A', 'D'],
    nearestStop: 'Porte de l’Hôpital',
    heroImageUrl: img('musee-alsacien'),
    outroTitle: 'Y aller',
    outroText: 'Descendez à Porte de l’Hôpital (lignes A et D) puis longez le quai Saint-Nicolas sur 300 mètres.',
    sections: [
      { title: 'Trois maisons, mille objets', body: 'Le musée occupe trois anciennes demeures strasbourgeoises reliées par des coursives en bois. Costumes, meubles peints et jouets racontent la vie alsacienne d’autrefois.' },
      { title: 'Bon plan', body: 'L’entrée est gratuite le premier dimanche du mois, comme dans la plupart des musées de la ville.' },
    ],
    gallery: imageGallery('musee-alsacien', 'Musée Alsacien'),
  },
  {
    slug: 'mamcs',
    title: 'MAMCS : l’art moderne au bord de l’Ill',
    excerpt: 'Le Musée d’Art moderne et contemporain et sa terrasse panoramique, à deux pas du Barrage Vauban. L’arrêt de tram porte son nom !',
    category: 'musees',
    publishedAt: '2026-05-30',
    readingMinutes: 5,
    lines: ['B', 'F'],
    nearestStop: 'Musée d’Art Moderne',
    heroImageUrl: img('mamcs'),
    outroTitle: 'Y aller',
    outroText: 'L’arrêt Musée d’Art Moderne (lignes B et F) est au pied du bâtiment.',
    sections: [
      { title: 'Des collections XXL', body: 'Peinture moderne, art contemporain, photographie et cabinet d’art graphique : le MAMCS couvre un siècle et demi de création sur 13 000 m².' },
      { title: 'La terrasse panoramique', body: 'Le café-restaurant du dernier étage offre l’une des plus belles vues sur les toits de la Petite France.' },
    ],
    gallery: imageGallery('mamcs', 'Musée d’Art moderne et contemporain'),
  },
  {
    slug: 'bnu',
    title: 'La BNU, joyau de la place de la République',
    excerpt: 'La deuxième bibliothèque de France, sa coupole et ses salles de lecture ouvertes à tous. Descendez simplement à République.',
    category: 'bibliotheques',
    publishedAt: '2026-05-18',
    readingMinutes: 4,
    lines: ['B', 'C', 'E', 'F'],
    nearestStop: 'République',
    heroImageUrl: img('bnu'),
    outroTitle: 'Y aller',
    outroText: 'Arrêt République, desservi par les lignes B, C, E et F.',
    sections: [
      { title: 'Un dôme monumental', body: 'Construite sous l’Empire allemand, la BNU abrite plus de trois millions de documents sous une coupole entièrement restaurée.' },
      { title: 'Ouverte à tous', body: 'La salle de lecture et les expositions temporaires sont accessibles sans carte d’étudiant. Montez au dernier niveau pour la vue sur la place de la République.' },
    ],
    gallery: imageGallery('bnu', 'Bibliothèque nationale et universitaire'),
  },
  {
    slug: 'mediatheque-malraux',
    title: 'Médiathèque André Malraux : lire face au bassin',
    excerpt: 'La grande médiathèque de la presqu’île Malraux, idéale pour travailler ou flâner. Accès direct depuis l’arrêt Winston Churchill.',
    category: 'bibliotheques',
    publishedAt: '2026-04-25',
    readingMinutes: 4,
    lines: ['C', 'E'],
    nearestStop: 'Winston Churchill',
    heroImageUrl: img('mediatheque-malraux'),
    outroTitle: 'Y aller',
    outroText: 'Arrêt Winston Churchill (lignes C et E), puis deux minutes à pied le long des quais.',
    sections: [
      { title: 'Le vaisseau amiral des médiathèques', body: 'Installée dans un ancien entrepôt portuaire, la médiathèque déploie cinq niveaux de collections face au bassin d’Austerlitz.' },
      { title: 'Travailler avec vue', body: 'Les grandes tables face aux baies vitrées sont prises d’assaut le week-end : visez l’ouverture à 10 h pour avoir les meilleures places.' },
    ],
    gallery: imageGallery('mediatheque-malraux', 'Médiathèque André Malraux'),
  },
  {
    slug: 'cathedrale-notre-dame',
    title: 'Cathédrale Notre-Dame : la géante de grès rose',
    excerpt: 'Horloge astronomique, plateforme panoramique et parvis animé. On vous explique quel arrêt choisir selon votre itinéraire.',
    category: 'lieux-historiques',
    publishedAt: '2026-07-02',
    readingMinutes: 7,
    lines: ['A', 'D'],
    nearestStop: 'Langstross Grand’Rue',
    heroImageUrl: img('cathedrale-notre-dame'),
    outroTitle: 'Y aller',
    outroText: 'Descendez à Langstross Grand’Rue (lignes A et D) : la flèche vous guide ensuite à travers les ruelles.',
    sections: [
      { title: 'Un chef-d’œuvre gothique', body: 'Avec sa flèche de 142 mètres, la cathédrale fut le plus haut monument du monde pendant plus de deux siècles. Sa façade de grès rose change de couleur au fil de la journée.' },
      { title: 'L’horloge astronomique', body: 'Le défilé des apôtres a lieu chaque jour à 12 h 30. Arrivez un quart d’heure avant pour profiter des explications.' },
    ],
    gallery: [...imageGallery('cathedrale-notre-dame', 'Cathédrale Notre-Dame de Strasbourg'), { type: 'youtube', src: DEMO_YOUTUBE_ID }],
  },
  {
    slug: 'petite-france',
    title: 'La Petite France, quartier de carte postale',
    excerpt: 'Canaux, maisons à colombages et ponts fleuris : le circuit à pied idéal depuis l’arrêt Alt Winmärik, en dehors de la foule.',
    category: 'lieux-historiques',
    publishedAt: '2026-06-08',
    readingMinutes: 6,
    lines: ['B', 'F'],
    nearestStop: 'Alt Winmärik',
    heroImageUrl: img('petite-france'),
    outroTitle: 'Y aller',
    outroText: 'Arrêt Alt Winmärik (lignes B et F), à trois minutes à pied des premiers canaux.',
    sections: [
      { title: 'Le quartier des tanneurs', body: 'Ses maisons à colombages des XVIe et XVIIe siècles abritaient tanneurs, meuniers et pêcheurs. Les toits ouverts servaient autrefois à sécher les peaux.' },
      { title: 'Le bon itinéraire', body: 'Depuis l’arrêt Alt Winmärik, rejoignez la place Benjamin-Zix puis suivez les canaux jusqu’aux Ponts Couverts, à l’écart des groupes.' },
    ],
    gallery: [...imageGallery('petite-france', 'Quartier de la Petite France'), { type: 'youtube', src: DEMO_YOUTUBE_ID }],
  },
  {
    slug: 'barrage-vauban',
    title: 'Barrage Vauban : le plus beau point de vue gratuit',
    excerpt: 'Sa terrasse offre une vue imprenable sur les Ponts Couverts et la cathédrale. À combiner avec la visite du MAMCS voisin.',
    category: 'lieux-historiques',
    publishedAt: '2026-04-12',
    readingMinutes: 3,
    lines: ['B', 'F'],
    nearestStop: 'Musée d’Art Moderne',
    heroImageUrl: img('barrage-vauban'),
    outroTitle: 'Y aller',
    outroText: 'Arrêt Musée d’Art Moderne (lignes B et F), le barrage est juste en face.',
    sections: [
      { title: 'Une forteresse sur l’eau', body: 'Édifié en 1690 sur les plans de Vauban, le barrage pouvait inonder tout le sud de la ville en cas d’attaque.' },
      { title: 'La terrasse panoramique', body: 'Montez sur le toit-terrasse, gratuit et ouvert tous les jours : la vue enfile les Ponts Couverts, la Petite France et la cathédrale.' },
    ],
    gallery: imageGallery('barrage-vauban', 'Barrage Vauban'),
  },
  {
    slug: 'place-kleber',
    title: 'Place Kléber : rendez-vous au centre-ville',
    excerpt: 'Marché de Noël, terrasses et grandes enseignes : la place la plus animée de Strasbourg, à une minute à pied d’Homme de Fer.',
    category: 'lieux-populaires',
    publishedAt: '2026-07-18',
    readingMinutes: 3,
    lines: ['A', 'B', 'C', 'D', 'F'],
    nearestStop: 'Homme de Fer',
    heroImageUrl: img('place-kleber'),
    outroTitle: 'Y aller',
    outroText: 'Arrêt Homme de Fer, toutes les lignes de tram du centre : la place est à une minute.',
    sections: [
      { title: 'Le salon de Strasbourg', body: 'Rendez-vous, manifestations, marché de Noël et son grand sapin : la place Kléber rythme la vie strasbourgeoise depuis le XVIIIe siècle.' },
      { title: 'L’Aubette', body: 'Ce bâtiment classé abrite des salles décorées par Jean Arp et Theo van Doesburg, un joyau de l’art abstrait librement accessible.' },
    ],
    gallery: imageGallery('place-kleber', 'Place Kléber'),
  },
  {
    slug: 'parc-orangerie',
    title: 'Parc de l’Orangerie : cigognes et barques',
    excerpt: 'Le plus ancien parc de la ville, son lac et son mini-zoo gratuit. La ligne E vous dépose à l’arrêt Droits de l’Homme.',
    category: 'lieux-populaires',
    publishedAt: '2026-05-05',
    readingMinutes: 5,
    lines: ['E'],
    nearestStop: 'Droits de l’Homme',
    heroImageUrl: img('parc-orangerie'),
    outroTitle: 'Y aller',
    outroText: 'Ligne E, arrêt Droits de l’Homme, puis cinq minutes à pied par l’allée de la Robertsau.',
    sections: [
      { title: 'Le jardin préféré des familles', body: 'Lac aux barques, mini-ferme gratuite et pavillon Joséphine : l’Orangerie est le plus ancien parc de la ville.' },
      { title: 'Les cigognes en majesté', body: 'Le parc héberge l’une des plus importantes colonies urbaines de cigognes blanches. Levez les yeux au printemps !' },
    ],
    gallery: imageGallery('parc-orangerie', 'Parc de l’Orangerie'),
  },
  {
    slug: 'jardin-botanique',
    title: 'Jardin botanique : une pause verte au campus',
    excerpt: 'Serres tropicales et collections centenaires au cœur du quartier universitaire. Descendez à Université ou Observatoire.',
    category: 'lieux-populaires',
    publishedAt: '2026-03-20',
    readingMinutes: 4,
    lines: ['C', 'E', 'F'],
    nearestStop: 'Université',
    heroImageUrl: img('jardin-botanique'),
    outroTitle: 'Y aller',
    outroText: 'Arrêts Université ou Observatoire (lignes C, E et F), à cinq minutes à pied.',
    sections: [
      { title: 'Un laboratoire à ciel ouvert', body: 'Créé en 1884, le jardin de l’université rassemble plus de 6 000 espèces, des plantes alpines aux serres tropicales.' },
      { title: 'Une pause studieuse', body: 'L’entrée est gratuite et le calme du lieu en fait un spot parfait pour réviser entre deux cours.' },
    ],
    gallery: imageGallery('jardin-botanique', 'Jardin botanique de Strasbourg'),
  },
]

/** Upserts one category (parent row + fr name) and returns its id. */
async function upsertCategory(category: SeedCategory): Promise<number> {
  const existing = await db
    .select({ id: blogCategories.id })
    .from(blogCategories)
    .where(eq(blogCategories.slug, category.slug))

  let categoryId: number
  if (existing[0]) {
    categoryId = existing[0].id
    await db
      .update(blogCategories)
      .set({ icon: category.icon, position: category.position })
      .where(eq(blogCategories.id, categoryId))
  }
  else {
    const inserted = await db
      .insert(blogCategories)
      .values({ slug: category.slug, icon: category.icon, position: category.position })
      .returning({ id: blogCategories.id })
    categoryId = inserted[0]!.id
  }

  // Upsert the translated name (unique on categoryId + locale).
  await db
    .insert(blogCategoryTranslations)
    .values({ categoryId, locale: DEFAULT_LOCALE, name: category.name })
    .onConflictDoUpdate({
      target: [blogCategoryTranslations.categoryId, blogCategoryTranslations.locale],
      set: { name: category.name },
    })

  return categoryId
}

async function seed() {
  // 1. Categories first — articles need their ids.
  const categoryIdBySlug = new Map<string, number>()
  for (const category of SEED_CATEGORIES) {
    categoryIdBySlug.set(category.slug, await upsertCategory(category))
    console.log(`✔ category ${category.slug}`)
  }

  // 2. Articles: replace by slug, one transaction per article so a
  //    failure never leaves a half-written article behind.
  for (const entry of SEED_ARTICLES) {
    const categoryId = categoryIdBySlug.get(entry.category)
    if (categoryId === undefined) {
      throw new Error(`Unknown category slug "${entry.category}" (article "${entry.slug}")`)
    }

    await db.transaction(async (tx) => {
      // Cascade cleans up translations, sections and media.
      await tx.delete(blogArticles).where(eq(blogArticles.slug, entry.slug))

      const inserted = await tx
        .insert(blogArticles)
        .values({
          slug: entry.slug,
          categoryId,
          status: 'published',
          publishedAt: entry.publishedAt,
          readingMinutes: entry.readingMinutes,
          heroImageUrl: entry.heroImageUrl,
          lines: entry.lines,
          nearestStop: entry.nearestStop,
        })
        .returning({ id: blogArticles.id })

      const articleId = inserted[0]!.id

      await tx.insert(blogArticleTranslations).values({
        articleId,
        locale: DEFAULT_LOCALE,
        title: entry.title,
        excerpt: entry.excerpt,
        outroTitle: entry.outroTitle,
        outroText: entry.outroText,
      })

      await tx.insert(blogArticleSections).values(
        entry.sections.map((section, position) => ({
          articleId,
          locale: DEFAULT_LOCALE,
          position,
          title: section.title,
          body: section.body,
        })),
      )

      await tx.insert(blogArticleMedia).values(
        entry.gallery.map((media, position) => ({ articleId, position, ...media })),
      )
    })

    console.log(`✔ article ${entry.slug}`)
  }

  console.log(`Seeded ${SEED_CATEGORIES.length} categories and ${SEED_ARTICLES.length} blog articles.`)
  process.exit(0)
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
