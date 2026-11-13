from django.core.management.base import BaseCommand
from arena.models import GalleryItem

DEFAULT_GALLERY_ITEMS = [
    {
        "external_id": "gal-1",
        "title": "Kitchen Dink Rally & Net Play",
        "item_type": "image",
        "category": "matchplay",
        "tag": "Live Action",
        "media_url": "/images/hero-player.jpg",
        "aspect": "tall",
        "caption": "Fast-paced third shot drop and kitchen rally exchanges on Court 1.",
        "order": 1,
    },
    {
        "external_id": "gal-2",
        "title": "Official Pro Selkirk Carbon Paddles",
        "item_type": "image",
        "category": "gear",
        "tag": "Pro Gear",
        "media_url": "/images/bullpadel-dark.jpg",
        "aspect": "square",
        "caption": "USAPA tournament-grade carbon fiber paddles and court balls available at reception.",
        "order": 2,
    },
    {
        "external_id": "gal-3",
        "title": "Baseline Reset & Court Defense",
        "item_type": "image",
        "category": "training",
        "tag": "Training",
        "media_url": "/images/athletes-team.jpg",
        "aspect": "tall",
        "caption": "Practicing the defensive baseline reset and crosscourt placement.",
        "order": 3,
    },
    {
        "external_id": "gal-4",
        "title": "Optic Yellow Court Ball in Flight",
        "item_type": "image",
        "category": "matchplay",
        "tag": "Matchplay",
        "media_url": "/images/gallery-reference-1.jpg",
        "aspect": "standard",
        "caption": "High-visibility optic balls designed for consistent court bounce.",
        "order": 4,
    },
    {
        "external_id": "gal-5",
        "title": "Precision Backhand Slice Grip",
        "item_type": "image",
        "category": "gear",
        "tag": "Equipment",
        "media_url": "/images/gallery-reference-2.jpg",
        "aspect": "tall",
        "caption": "Ergonomic moisture-wicking paddle grip for control and spin.",
        "order": 5,
    },
    {
        "external_id": "gal-6",
        "title": "Overhead Smash & Volley Action",
        "item_type": "image",
        "category": "tournament",
        "tag": "Match Action",
        "media_url": "/images/joola-court.jpg",
        "aspect": "standard",
        "caption": "Agile overhead court coverage and smashes during competitive play.",
        "order": 6,
    },
    {
        "external_id": "gal-7",
        "title": "Singles Speed & Footwork Coverage",
        "item_type": "image",
        "category": "matchplay",
        "tag": "Court Play",
        "media_url": "/images/hero-action.jpg",
        "aspect": "tall",
        "caption": "High-tempo singles rally across the full outdoor and indoor court surface.",
        "order": 7,
    },
    {
        "external_id": "gal-8",
        "title": "Court Arena Illumination",
        "item_type": "image",
        "category": "tournament",
        "tag": "Arena",
        "media_url": "/images/court-wide.jpg",
        "aspect": "standard",
        "caption": "Evening LED lighting setup across our dedicated Gondal pickleball courts.",
        "order": 8,
    },
]


class Command(BaseCommand):
    help = "Surgically syncs gallery items and repairs broken ephemeral media URLs without touching bookings, users, or revenue."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Starting surgical gallery items sync..."))
        created_count = 0
        repaired_count = 0

        for g in DEFAULT_GALLERY_ITEMS:
            ext_id = g["external_id"]
            item = GalleryItem.objects.filter(external_id=ext_id).first()
            if not item:
                # Also check title match
                item = GalleryItem.objects.filter(title__iexact=g["title"]).first()

            if not item:
                GalleryItem.objects.create(**g)
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"  [CREATED] {ext_id}: {g['title']}"))
            else:
                # Repair gal-2 if pointing to wiped Render ephemeral media
                if ext_id == "gal-2" and ("1794565470" in (item.media_url or "") or "/media/gallery" in (item.media_url or "")):
                    item.media_url = g["media_url"]
                    item.media_file = None
                    item.save()
                    repaired_count += 1
                    self.stdout.write(self.style.WARNING(f"  [REPAIRED] {ext_id}: Restored durable asset {g['media_url']}"))

        total_items = GalleryItem.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Gallery sync complete! Total items: {total_items} (Created: {created_count}, Repaired: {repaired_count}). Zero bookings/users affected."
            )
        )

