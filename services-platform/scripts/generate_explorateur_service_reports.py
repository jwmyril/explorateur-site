from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
OUT.mkdir(parents=True, exist_ok=True)

pdfmetrics.registerFont(TTFont("Atmart", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Atmart-Bold", r"C:\Windows\Fonts\arialbd.ttf"))

NAVY = colors.HexColor("#071A33")
TEAL = colors.HexColor("#078C83")
CYAN = colors.HexColor("#31B8D5")
TEXT = colors.HexColor("#455568")
PALE = colors.HexColor("#F3F8F8")
LINE = colors.HexColor("#B9D1D7")
WHITE = colors.white

W, H = A4
M = 17 * mm
CONTENT_W = W - 2 * M


def pstyle(name, size=8.2, leading=10.8, color=TEXT, bold=False, align=TA_LEFT):
    return ParagraphStyle(name, fontName="Atmart-Bold" if bold else "Atmart",
                          fontSize=size, leading=leading, textColor=color,
                          alignment=align, spaceAfter=0)


BODY = pstyle("body")
SMALL = pstyle("small", 7.2, 9.2)
TINY = pstyle("tiny", 5.7, 7.2, colors.HexColor("#8192A4"))
H2 = pstyle("h2", 8.9, 10.5, TEAL, True)
BOX_TITLE = pstyle("boxTitle", 8.2, 9.6, NAVY, True)
BOX_BODY = pstyle("boxBody", 7.5, 9.5)


REPORTS = [
    {
        "file": "rapport-territorial-atmart.pdf",
        "title": "Rapport territorial Atmart",
        "tag": "Décider avec une lecture claire du territoire, de ses écarts et de ses priorités.",
        "promise": "Les données de l’Explorateur restent gratuites. Le service payant transforme ces données en <b>diagnostic contextualisé, priorités et recommandations prêtes à agir</b>.",
        "audience": "Collectivités, ONG, bailleurs, entreprises et équipes de programme qui préparent une intervention, une stratégie territoriale ou une note de décision.",
        "steps": [
            ("Cadrage de la décision", "Territoire, public, question stratégique, période et indicateurs prioritaires."),
            ("Lecture territoriale", "Profil démographique, social, économique et d’accès aux services; écarts et tendances."),
            ("Comparaison utile", "Positionnement face aux territoires comparables et aux références disponibles."),
            ("Priorisation", "Enjeux classés selon ampleur, urgence, faisabilité et qualité des preuves."),
            ("Restitution", "Rapport commenté et échange de validation avec votre équipe."),
        ],
        "deliver": [
            ("Synthèse exécutive", "Messages clés et décisions à prendre."),
            ("Portrait du territoire", "Indicateurs, graphiques et cartes disponibles."),
            ("Matrice des priorités", "Enjeux, preuves, risques et pistes d’action."),
            ("Annexe méthodologique", "Sources, définitions, limites et date des données."),
            ("Fichiers exploitables", "PDF final et tableaux utilisés pour l’analyse."),
        ],
        "excluded": "Collecte primaire sur le terrain, enquête représentative, audit financier, évaluation d’impact causale et données non accessibles légalement. Ces besoins peuvent faire l’objet d’un devis distinct.",
        "price": "149 USD",
        "price_note": "par rapport standard",
        "price_copy": "Un territoire, une question principale et un cycle de révision. Toute extension de périmètre est chiffrée avant démarrage.",
        "why": [("Données traçables", "Chaque constat renvoie à sa source et à sa date."), ("Analyse, pas revente", "Vous payez l’expertise; l’accès aux données reste gratuit."), ("Livrable réutilisable", "Le rapport et ses tableaux restent à votre organisation.")],
    },
    {
        "file": "rapport-diagnostic-atmart.pdf",
        "title": "Rapport diagnostic Atmart",
        "tag": "Mesurer la qualité de vos données avant qu’elles ne fragilisent vos décisions.",
        "promise": "Un tableau de bord peut sembler convaincant tout en reposant sur des données incomplètes. Le diagnostic rend la qualité <b>visible, mesurable et améliorable</b>.",
        "audience": "Organisations qui utilisent des fichiers, bases, indicateurs ou tableaux de bord et veulent connaître les erreurs, les risques et les corrections prioritaires.",
        "steps": [("Inventaire", "Jeux de données, propriétaires, usages et décisions dépendantes."), ("Profilage", "Complétude, unicité, cohérence, validité, fraîcheur et valeurs atypiques."), ("Contrôles métier", "Tests des règles, dénominateurs, dates, codes géographiques et agrégations."), ("Analyse des risques", "Impact potentiel des anomalies sur les résultats et la confiance."), ("Plan de correction", "Actions classées par priorité, effort, responsable et délai.")],
        "deliver": [("Scorecard qualité", "Résultats par dimension et par jeu de données."), ("Registre des anomalies", "Erreur, preuve, gravité et recommandation."), ("Diagnostic des processus", "Points de rupture de la collecte à la publication."), ("Plan d’amélioration", "Corrections immédiates et contrôles durables."), ("Réunion de restitution", "Lecture guidée et réponses aux questions.")],
        "excluded": "Nettoyage complet de toutes les données, reconstruction d’un système d’information, certification réglementaire, saisie rétrospective ou maintenance continue.",
        "price": "249 USD", "price_note": "par audit standard", "price_copy": "Jusqu’à trois jeux de données de taille raisonnable et une restitution. Le périmètre exact est validé avant l’analyse.",
        "why": [("Constats prouvés", "Chaque anomalie est associée à un test reproductible."), ("Priorités réalistes", "Les corrections sont classées par risque et effort."), ("Autonomie", "Les règles de contrôle vous sont remises et documentées.")],
    },
    {
        "file": "rapport-scenarios-atmart.pdf",
        "title": "Simulateur de scénarios Atmart",
        "tag": "Comparer les choix possibles avant d’engager les ressources.",
        "promise": "Un scénario n’est pas une prédiction. Le service permet de tester des hypothèses transparentes et de voir <b>ce qui change, pour qui et à quel coût</b>.",
        "audience": "Équipes de programme, analystes et décideurs qui doivent comparer des options territoriales, budgétaires ou opérationnelles avec une méthode commune.",
        "steps": [("Définition du cas", "Décision, population, horizon, contraintes et indicateurs de résultat."), ("Hypothèses", "Valeurs de référence, fourchettes et règles de calcul documentées."), ("Construction", "Configuration de scénarios comparables et contrôles de cohérence."), ("Analyse de sensibilité", "Variables qui influencent le plus les résultats et zones d’incertitude."), ("Revue mensuelle", "Un nouveau cas d’usage ou une amélioration du modèle existant.")],
        "deliver": [("Espace de simulation", "Scénarios enregistrés et comparables."), ("Note de résultats", "Écarts, coûts, bénéficiaires et limites."), ("Table des hypothèses", "Sources, valeurs et responsable de validation."), ("Export des résultats", "Tableaux prêts pour vos réunions et rapports."), ("Support d’équipe", "Révision mensuelle du cas prioritaire.")],
        "excluded": "Prévision garantie, modèle économétrique sur mesure, collecte de données, décision automatisée, ou nombre illimité de scénarios complexes.",
        "price": "99 USD/mois", "price_note": "abonnement équipe", "price_copy": "Un cas d’usage actif par mois. Résiliable mensuellement; vos résultats et exports restent les vôtres.",
        "why": [("Hypothèses visibles", "Aucun résultat sans règles et sources documentées."), ("Comparaison cohérente", "Les options utilisent les mêmes indicateurs et unités."), ("Décision humaine", "Le simulateur éclaire le choix; il ne décide pas à votre place.")],
    },
    {
        "file": "rapport-instance-institutionnelle-atmart.pdf",
        "title": "Instance institutionnelle Atmart",
        "tag": "Un espace Explorateur adapté à votre organisation, à vos règles et à vos usages.",
        "promise": "Centralisez vos analyses sans enfermer vos équipes. L’instance apporte <b>configuration, gouvernance, accès contrôlé et accompagnement</b>, tandis que les données publiques restent gratuites.",
        "audience": "Institutions, réseaux et programmes qui ont besoin d’un environnement partagé, d’indicateurs propres, de rôles d’accès et d’un cadre de gouvernance.",
        "steps": [("Cadrage institutionnel", "Utilisateurs, responsabilités, domaines, risques et règles d’accès."), ("Configuration", "Identité visuelle, espaces, indicateurs et parcours de consultation."), ("Intégration", "Ajout des jeux autorisés et documentation des sources."), ("Validation", "Tests d’accès, contrôles fonctionnels et acceptation par l’équipe."), ("Suivi", "Maintenance applicative et revue régulière des besoins.")],
        "deliver": [("Instance dédiée", "Espace configuré aux couleurs de l’organisation."), ("Gestion des accès", "Comptes, rôles et séparation des contenus privés."), ("Catalogue documenté", "Indicateurs, sources, définitions et responsables."), ("Guide administrateur", "Procédures essentielles et règles de gouvernance."), ("Support prioritaire", "Traitement des demandes selon le périmètre convenu.")],
        "excluded": "Développement illimité, licences tierces, nettoyage massif, infrastructure hors périmètre, saisie continue ou engagement de disponibilité non contractualisé.",
        "price": "249 USD/mois", "price_note": "instance standard", "price_copy": "Configuration initiale incluse dans un périmètre standard. Les intégrations complexes font l’objet d’un devis séparé.",
        "why": [("Accès maîtrisé", "Les rôles distinguent données publiques et contenus privés."), ("Documentation intégrée", "Sources et règles restent visibles pour les utilisateurs."), ("Sans verrouillage", "Exports disponibles et résiliation mensuelle.")],
    },
]


def para(c, html, style, x, y_top, width, max_h=100*mm):
    p = Paragraph(html, style)
    w, h = p.wrap(width, max_h)
    p.drawOn(c, x, y_top - h)
    return h


def logo(c, x, y):
    c.setLineWidth(1.8)
    c.setStrokeColor(NAVY)
    c.circle(x + 9*mm, y, 6.2*mm, stroke=1, fill=0)
    c.setStrokeColor(CYAN)
    for i in range(5):
        off = i * 1.25*mm
        c.bezier(x+14*mm, y+3*mm-off, x+21*mm, y+4*mm-off, x+20*mm, y-3*mm-off, x+27*mm, y-1*mm-off)


def section_heading(c, text, x, y, width):
    para(c, text.upper(), H2, x, y, width)
    c.setStrokeColor(LINE); c.setLineWidth(.45)
    c.line(x, y-4.2*mm, x+width, y-4.2*mm)


def numbered_list(c, items, x, y, width):
    for idx, (title, desc) in enumerate(items, 1):
        c.setFillColor(NAVY); c.circle(x+3*mm, y-2.4*mm, 2.7*mm, fill=1, stroke=0)
        c.setFillColor(WHITE); c.setFont("Atmart-Bold", 7.3); c.drawCentredString(x+3*mm, y-3.3*mm, str(idx))
        h1 = para(c, title, BOX_TITLE, x+8*mm, y, width-8*mm)
        h2 = para(c, desc, BOX_BODY, x+8*mm, y-h1, width-8*mm)
        y -= max(10.5*mm, h1+h2+1.2*mm)
    return y


def deliverables(c, items, x, y, width):
    for title, desc in items:
        total_h = 12.2*mm
        c.setFillColor(colors.HexColor("#F7FAFA")); c.rect(x, y-total_h, width, total_h-0.8*mm, fill=1, stroke=0)
        c.setFillColor(TEAL); c.rect(x, y-total_h, .65*mm, total_h-0.8*mm, fill=1, stroke=0)
        h1 = para(c, title, BOX_TITLE, x+4*mm, y-2*mm, width-7*mm)
        para(c, desc, BOX_BODY, x+4*mm, y-2*mm-h1, width-7*mm)
        y -= total_h
    return y


def create_report(data):
    path = OUT / data["file"]
    c = Canvas(str(path), pagesize=A4)
    c.setTitle(data["title"])

    logo(c, M, H-23*mm)
    title_x = M + 34*mm
    title_parts = data["title"].replace(" Atmart", " <font color='#078C83'>Atmart</font>")
    para(c, title_parts, pstyle("title", 16.4, 18.5, NAVY, True), title_x, H-15*mm, 112*mm)
    para(c, data["tag"], pstyle("tag", 7.9, 10), title_x, H-24*mm, 112*mm)
    para(c, "<b>Atmart LLC</b><br/><font color='#455568'>Conseil et données<br/>pour la décision<br/>atmart.ltd</font>", pstyle("brand", 8.1, 11, NAVY, False, TA_RIGHT), W-M-40*mm, H-14.5*mm, 40*mm)
    c.setStrokeColor(NAVY); c.setLineWidth(1.2); c.line(M, H-40*mm, W-M, H-40*mm)

    y = H-45*mm
    c.setFillColor(PALE); c.rect(M, y-17*mm, CONTENT_W, 17*mm, fill=1, stroke=0)
    c.setFillColor(TEAL); c.rect(M, y-17*mm, .9*mm, 17*mm, fill=1, stroke=0)
    para(c, data["promise"], pstyle("promise", 8.5, 11.8, colors.HexColor("#233547")), M+5*mm, y-4.5*mm, CONTENT_W-10*mm)

    y -= 22*mm
    section_heading(c, "À qui s’adresse ce service", M, y, CONTENT_W)
    para(c, data["audience"], BODY, M, y-7*mm, CONTENT_W)

    y -= 23*mm
    gap = 8*mm
    col = (CONTENT_W-gap)/2
    section_heading(c, "Comment se déroule la mission", M, y, col)
    section_heading(c, "Ce que vous recevez", M+col+gap, y, col)
    bottom_l = numbered_list(c, data["steps"], M, y-8*mm, col)
    bottom_r = deliverables(c, data["deliver"], M+col+gap, y-7.5*mm, col)

    y = min(bottom_l, bottom_r)-2*mm
    section_heading(c, "Ce qui n’est pas inclus", M, y, col)
    para(c, data["excluded"], SMALL, M, y-7*mm, col)

    price_y = 68*mm
    c.setFillColor(NAVY); c.roundRect(M, price_y, CONTENT_W, 21*mm, 2.4*mm, fill=1, stroke=0)
    para(c, data["price"], pstyle("price", 13.5, 15, WHITE, True), M+5*mm, price_y+15.5*mm, 45*mm)
    para(c, data["price_note"], pstyle("pnote", 7.2, 8.5, colors.HexColor("#C9DAE7")), M+5*mm, price_y+8*mm, 45*mm)
    para(c, data["price_copy"], pstyle("pcopy", 7.5, 9.6, WHITE), M+52*mm, price_y+15.5*mm, CONTENT_W-58*mm)

    y = price_y-5*mm
    section_heading(c, "Pourquoi Atmart", M, y, CONTENT_W)
    box_gap = 5*mm; bw=(CONTENT_W-2*box_gap)/3; by=31*mm; bh=25*mm
    for i, (title, desc) in enumerate(data["why"]):
        x=M+i*(bw+box_gap)
        c.setFillColor(colors.HexColor("#F8FBFB")); c.setStrokeColor(LINE); c.roundRect(x, by, bw, bh, 2*mm, fill=1, stroke=1)
        h=para(c, title, BOX_TITLE, x+3*mm, by+bh-3*mm, bw-6*mm)
        para(c, desc, SMALL, x+3*mm, by+bh-4*mm-h, bw-6*mm)

    c.setStrokeColor(NAVY); c.setLineWidth(.7); c.line(M, 26*mm, W-M, 26*mm)
    para(c, "<b>Prochaine étape : un échange de 30 minutes</b>", pstyle("next", 9.5, 11, NAVY, True), M, 22.5*mm, 105*mm)
    para(c, "Précisez votre territoire, vos données et la décision à préparer. Nous confirmerons le périmètre, le délai et le livrable avant toute commande.", SMALL, M, 17.5*mm, 125*mm)
    para(c, "<b><font color='#078C83'>sales@atmart.ltd</font></b><br/>atmart.ltd", pstyle("contact", 8, 10, NAVY, False, TA_RIGHT), W-M-47*mm, 20*mm, 47*mm)
    para(c, "Atmart fournit une analyse et un accompagnement à la décision. Les constats dépendent des sources disponibles et de leur qualité. Les données publiques de l’Explorateur restent accessibles gratuitement; le prix couvre le service professionnel, la personnalisation et les livrables.", TINY, M, 9.5*mm, CONTENT_W)
    c.save()
    return path


if __name__ == "__main__":
    for report in REPORTS:
        print(create_report(report))
