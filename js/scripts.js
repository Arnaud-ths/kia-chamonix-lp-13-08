/* ==========================================================================
   Kia x Chamonix-Mont-Blanc x Sun Valley - Jeu concours 2026
   Quiz 3 questions + formulaire de participation
   ========================================================================== */

(function () {
  "use strict";

  /* ======================================================================
     CONFIGURATION
     ====================================================================== */

  /* Web service dedie Chamonix.
     Specs : concours_chamonix.php?_documentation=1 */
  var WS_URL = "https://www.insightondemand.fr/webservice/rest/kia/concours_chamonix.php";

  /* Valeur fixe imposee par le WS */
  var CAMPAGNE = "KIA_CONCOURS_CHAMONIX_2026";

  /* Mode production. Repasser a true pour rejouer des tests sans ecrire en
     base : le WS journalise alors la requete et repond "(TESTMODE) OK". */
  var TESTMODE = false;

  /* Pixel de tracking a poser sur la page d'arrivee.
     [source] et [levier] sont remplaces par les parametres d'URL. */
  var PIXEL_URL =
    "https://05m.fr/clictrack?campagne=Kia_Chamonix_SunValley_092026&origine=[source]&levier=[levier]";

  /* Confirmation apres envoi :
       "inline"   -> l'ecran de remerciement s'affiche dans la page (etape 5)
       "redirect" -> renvoi vers merci.html, utile si le tracking a besoin
                     d'une URL de conversion distincte.
     merci.html est conserve et reste synchronise avec le bloc inline. */
  var CONFIRM_MODE = "redirect";
  var CONFIRM_URL = "merci.html";

  /* Mode production : l'appel au WS est actif.
     Repasser a true pour travailler en local sans reseau (le WS renvoie alors
     une erreur CORS) : le payload part en console et on enchaine sur la page
     de confirmation. */
  var DRY_RUN = false;

  /* ======================================================================
     ETAT
     ====================================================================== */

  var answers = {};          /* { 1: "1786", 2: "1983", 3: "À la journée" } */
  var quizCards = Array.prototype.slice.call(document.querySelectorAll(".quiz[data-step]"));
  var formCard = document.querySelector(".quiz-form");
  var form = document.getElementById("participation-form");
  var formError = document.querySelector(".quiz-form__error");
  var successCard = document.querySelector(".quiz-success");
  var universSection = document.querySelector(".univers");

  var urlParams = new URLSearchParams(window.location.search);
  var source = urlParams.get("source") || "";
  var levier = urlParams.get("levier") || "";

  /* ======================================================================
     PIXEL DE TRACKING
     Pose sur la page d'arrivee : c'est la seule ou "source" et "levier" sont
     presents dans l'URL. Positionne hors flux pour ne pas ajouter 1px au bas
     de la page (l'appel reseau est identique a celui d'un <img> classique).
     ====================================================================== */

  (function insertTrackingPixel() {
    var pixel = document.createElement("img");
    pixel.src = PIXEL_URL
      .replace("[source]", encodeURIComponent(source))
      .replace("[levier]", encodeURIComponent(levier));
    pixel.alt = "";
    pixel.width = 1;
    pixel.height = 1;
    pixel.setAttribute("aria-hidden", "true");
    pixel.style.cssText =
      "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;";
    document.body.appendChild(pixel);
  })();

  /* ======================================================================
     NAVIGATION QUIZ
     ====================================================================== */

  /* Marge laissee au-dessus du formulaire quand on arrive a l'etape 4 */
  var FORM_SCROLL_OFFSET = 40;

  function scrollToElement(el, offset) {
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.pageYOffset - (offset || 0);
    window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
  }

  function scrollToQuiz() {
    scrollToElement(document.getElementById("quiz"), 0);
  }

  /* D'une question a l'autre : aucun defilement, les cartes font la meme
     hauteur et occupent la meme place, l'utilisateur reste ou il est.
     Vers le formulaire : celui-ci est bien plus haut qu'une carte question,
     on le recadre en laissant FORM_SCROLL_OFFSET au-dessus.

     Le bouton clique se retrouve dans une carte passee en display:none. Le
     navigateur deplace alors le focus tout seul, et certains le font en
     scrollant. On reprend donc la main : focus explicite sur la carte suivante
     avec preventScroll, ce qui fige le comportement quel que soit le navigateur
     et annonce correctement l'etape aux lecteurs d'ecran. */
  function showStep(step) {
    var next = null;

    quizCards.forEach(function (card) {
      var active = Number(card.dataset.step) === step;
      card.classList.toggle("quiz--active", active);
      if (active) next = card;
    });

    formCard.classList.toggle("is-active", step === 4);
    if (successCard) successCard.classList.toggle("is-active", step === 5);

    /* La section "Découvrez nos trois univers" contient les reponses au quiz :
       on la retire une fois le formulaire atteint. Elle est situee apres le
       formulaire dans le DOM, la masquer ne decale donc pas son offsetTop. */
    if (universSection) universSection.classList.toggle("is-hidden", step >= 4);

    if (step === 4) next = formCard;
    if (step === 5) next = successCard;
    if (!next) return;

    var target = next.querySelector(".quiz__question, h2") || next;
    target.setAttribute("tabindex", "-1");
    try {
      target.focus({ preventScroll: true });
    } catch (e) {
      /* navigateurs sans support de l'option : on ne force pas le focus */
    }

    if (step >= 4) scrollToElement(next, FORM_SCROLL_OFFSET);
  }

  quizCards.forEach(function (card) {
    var step = Number(card.dataset.step);
    var error = card.querySelector(".quiz__error");

    /* selection d'une reponse : une seule active par question */
    card.querySelectorAll(".quiz__answer").forEach(function (btn) {
      btn.addEventListener("click", function () {
        card.querySelectorAll(".quiz__answer").forEach(function (b) {
          b.classList.remove("is-selected");
        });
        btn.classList.add("is-selected");
        answers[step] = btn.dataset.value;
        error.classList.remove("is-visible");
      });
    });

    /* validation de la question */
    card.querySelector(".quiz__next").addEventListener("click", function () {
      if (!answers[step]) {
        error.textContent = "Merci de sélectionner une réponse.";
        error.classList.add("is-visible");
        return;
      }
      showStep(step + 1);
    });
  });

  /* CTA "Je participe" : scroll doux vers le quiz */
  document.querySelectorAll(".scroll-to").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      scrollToQuiz();
    });
  });

  /* Un lien place dans un <label> declenche AUSSI le controle associe : sans
     ca, ouvrir le reglement cocherait la case "conditions de participation".
     On stoppe donc la propagation vers le label. */
  document.querySelectorAll(".checkbox a").forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  });

  /* ======================================================================
     VALIDATION DU FORMULAIRE
     ====================================================================== */

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var TEL_RE = /^(?:(?:\+|00)33|0)[1-9]\d{8}$/;
  var CP_RE = /^\d{5}$/;

  function setInvalid(el, invalid) {
    el.classList.toggle("is-invalid", invalid);
  }

  function fail(message) {
    formError.textContent = message;
    formError.classList.add("is-visible");
    formError.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }

  function validate() {
    formError.classList.remove("is-visible");

    var civilite = form.querySelector('input[name="civilite"]:checked');
    if (!civilite) return fail("Merci de sélectionner une civilité.");

    var required = ["nom", "prenom", "email", "tel", "postal", "ville"];
    for (var i = 0; i < required.length; i++) {
      var input = form.elements[required[i]];
      var empty = input.value.trim() === "";
      setInvalid(input, empty);
      if (empty) return fail("Merci de renseigner tous les champs obligatoires.");
    }

    var email = form.elements.email;
    if (!EMAIL_RE.test(email.value.trim())) {
      setInvalid(email, true);
      return fail("Merci de saisir une adresse e-mail valide.");
    }
    setInvalid(email, false);

    var tel = form.elements.tel;
    if (!TEL_RE.test(tel.value.replace(/[\s.\-()]/g, ""))) {
      setInvalid(tel, true);
      return fail("Merci de saisir un numéro de téléphone français valide (ex : 0612345678).");
    }
    setInvalid(tel, false);

    var postal = form.elements.postal;
    if (!CP_RE.test(postal.value.trim())) {
      setInvalid(postal, true);
      return fail("Merci de saisir un code postal valide (5 chiffres).");
    }
    setInvalid(postal, false);

    if (!form.elements.conditions.checked) {
      return fail("Merci d'accepter les conditions de participation.");
    }

    return true;
  }

  /* ======================================================================
     ENVOI
     ====================================================================== */

  function buildPayload() {
    /* Les valeurs de reponses sont portees par les data-value des boutons et
       correspondent deja a celles attendues par le WS (1492/1786/1886,
       1975/1983/1998, semaine/journée/mois). */
    var payload = {
      campagne: CAMPAGNE,
      civilite: form.querySelector('input[name="civilite"]:checked').value === "M" ? "Mr" : "Mrs",
      nom: form.elements.nom.value.trim(),
      prenom: form.elements.prenom.value.trim(),
      email: form.elements.email.value.trim(),
      telephone: form.elements.tel.value.replace(/\s/g, ""),
      code_postal: form.elements.postal.value.trim(),
      ville: form.elements.ville.value.trim(),
      optin_kia: form.elements.optin_kia.checked ? "oui" : "non",
      optin_chamonix: form.elements.optin_chamonix.checked ? "oui" : "non",
      optin_sunvalley: form.elements.optin_sunvalley.checked ? "oui" : "non",
      question1: answers[1] || "",
      question2: answers[2] || "",
      question3: answers[3] || "",
      source: source,
      levier: levier
    };

    if (TESTMODE) payload.testmode = "y";

    return payload;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validate()) return;

    var submitBtn = form.querySelector(".quiz-form__submit");
    var label = submitBtn.querySelector(".cta__text");
    var payload = buildPayload();

    submitBtn.disabled = true;
    label.textContent = "Envoi en cours…";

    function done() {
      if (CONFIRM_MODE === "redirect") {
        /* source/levier sont propages : merci.html peut ainsi porter un pixel
           ou un tag de conversion sans perdre l'origine du trafic. */
        var params = new URLSearchParams({ prenom: payload.prenom });
        if (source) params.set("source", source);
        if (levier) params.set("levier", levier);
        window.location.href = CONFIRM_URL + "?" + params.toString();
        return;
      }
      showStep(5);
    }

    function reset(message) {
      submitBtn.disabled = false;
      label.textContent = "Valider ma participation";
      fail(message);
    }

    if (DRY_RUN) {
      console.warn("[DRY_RUN] Envoi désactivé — payload qui aurait été posté :", payload);
      done();
      return;
    }

    /* ⚠️ Le WS lit ses parametres dans la QUERY STRING, pas dans le corps de
       la requete : un POST classique avec un body urlencode renvoie
       "The field ... is missing" sur tous les champs (verifie en testmode). */
    fetch(WS_URL + "?" + new URLSearchParams(payload).toString(), {
      method: "GET",
      cache: "no-store"
    })
      .then(function (res) {
        return res.text();
      })
      .then(function (text) {
        var body = String(text).trim();

        /* Certaines reponses sont encapsulees : {"response":"ERR\\r\\n..."} */
        try {
          var json = JSON.parse(body);
          if (json && typeof json.response === "string") body = json.response.trim();
        } catch (e) {
          /* reponse en texte brut : "OK", "(TESTMODE) OK", "(TESTMODE) ERR..." */
        }

        /* Succes : "OK" ou "(TESTMODE) OK".
           \b evite de confondre avec un "NOK" ou un mot contenant OK. */
        if (/\bOK\b/.test(body)) {
          done();
          return;
        }

        /* Les libelles d'erreur du WS sont techniques et en anglais
           ("The field `email` is missing or has an incorrect value") :
           on les journalise sans les montrer a l'internaute. */
        console.error("[WS] Réponse en erreur :", body);
        reset("Erreur lors de l'envoi. Veuillez réessayer.");
      })
      .catch(function () {
        reset("Erreur réseau. Veuillez réessayer.");
      });
  });
})();
