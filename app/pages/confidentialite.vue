<script setup lang="ts">
  import InfoPageShell from '~/components/ui/InfoPageShell.vue'

  useSeoMeta({
    title: 'Politique de confidentialité — Strasbourg Bus-Trams Live',
    description: 'Politique de confidentialité de Strasbourg Bus-Trams Live : données collectées, géolocalisation, cookies, publicité Google AdSense et vos droits RGPD.',
  })
</script>

<template>
  <info-page-shell
    title="Politique de confidentialité"
    subtitle="Dernière mise à jour : 21 juillet 2026"
    icon="mdi-shield-lock-outline"
  >
    <p>
      Cette page explique quelles données sont traitées lorsque vous utilisez
      <strong>Strasbourg Bus-Trams Live</strong> (ci-après « le Site »), pourquoi, et quels sont vos
      droits. Notre principe est simple : <strong>nous collectons le strict minimum</strong> — le
      Site fonctionne sans compte utilisateur et ne stocke aucune donnée personnelle sur ses serveurs.
    </p>

    <h2>1. Données que nous ne collectons pas</h2>
    <ul>
      <li>Aucune création de compte, aucun identifiant, aucun mot de passe ;</li>
      <li>Aucun profil publicitaire constitué par nos soins ;</li>
      <li>Aucune revente de données à des tiers.</li>
    </ul>

    <h2>2. Géolocalisation</h2>
    <p>
      La fonction « Autour de moi » utilise la position de votre appareil <strong>uniquement avec
      votre autorisation explicite</strong>, demandée par votre navigateur. Vos coordonnées sont
      envoyées à notre serveur dans le seul but de calculer les arrêts les plus proches ; elles ne
      sont <strong>ni conservées, ni associées à votre identité, ni transmises à des tiers</strong>.
      Vous pouvez retirer cette autorisation à tout moment dans les réglages de votre navigateur.
    </p>

    <h2>3. Données stockées sur votre appareil</h2>
    <p>Certaines préférences sont enregistrées localement, dans votre navigateur uniquement :</p>
    <ul>
      <li><strong>Favoris</strong> — vos arrêts et listes de favoris (stockage local du navigateur) ;</li>
      <li><strong>Thème</strong> — votre préférence clair / sombre (cookie technique) ;</li>
      <li><strong>Cache hors-ligne</strong> — l’application installable (PWA) met en cache des ressources pour fonctionner plus vite.</li>
    </ul>
    <p>
      Ces données ne quittent jamais votre appareil. Vous pouvez les effacer à tout moment en
      supprimant les données de navigation du Site.
    </p>

    <h2>4. Cookies et publicité (Google AdSense)</h2>
    <p>
      Le Site peut afficher des annonces fournies par <strong>Google AdSense</strong>. Google et
      ses partenaires utilisent des cookies pour diffuser des annonces, le cas échéant adaptées à
      vos centres d’intérêt, et pour en mesurer l’audience :
    </p>
    <ul>
      <li>Google utilise des cookies publicitaires permettant à ses partenaires de diffuser des annonces basées sur vos visites sur ce site et d’autres sites ;</li>
      <li>Vous pouvez désactiver la publicité personnalisée dans les <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">paramètres des annonces Google</a> ;</li>
      <li>Le fonctionnement des cookies publicitaires de Google est détaillé dans les <a href="https://policies.google.com/technologies/ads?hl=fr" target="_blank" rel="noopener noreferrer">règles de Google en matière de publicité</a> ;</li>
      <li>Conformément à la réglementation européenne, votre consentement est recueilli avant tout dépôt de cookie publicitaire.</li>
    </ul>

    <h2>5. Services tiers</h2>
    <p>Pour fonctionner, le Site s’appuie sur des services externes qui peuvent recevoir des requêtes techniques (adresse IP notamment) :</p>
    <ul>
      <li><strong>CTS (open data)</strong> — horaires théoriques et passages en temps réel, interrogés par notre serveur ;</li>
      <li><strong>OpenFreeMap</strong> — fond de carte interactif (données OpenStreetMap) ;</li>
      <li><strong>Hébergeur</strong> — le Site est hébergé par Netlify, qui génère des journaux techniques standards (voir <NuxtLink to="/mentions-legales">mentions légales</NuxtLink>).</li>
    </ul>

    <h2>6. Vos droits (RGPD)</h2>
    <p>
      Conformément au Règlement général sur la protection des données (RGPD) et à la loi
      Informatique et Libertés, vous disposez de droits d’accès, de rectification, d’effacement,
      d’opposition et de portabilité sur vos données. Le Site ne conservant aucune donnée
      personnelle côté serveur, la plupart de ces droits s’exercent directement depuis votre
      navigateur (suppression des données locales). Pour toute question, contactez-nous via la
      page <NuxtLink to="/contact">Contact</NuxtLink>. Vous pouvez également adresser une
      réclamation à la <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">CNIL</a>.
    </p>

    <h2>7. Modifications de cette politique</h2>
    <p>
      Cette politique peut évoluer, par exemple à l’ajout d’une nouvelle fonctionnalité. La date
      de dernière mise à jour figure en haut de cette page ; les changements significatifs seront
      signalés sur le Site.
    </p>
  </info-page-shell>
</template>
