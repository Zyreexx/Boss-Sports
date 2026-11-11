import argparse
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'boss_backend.settings')
django.setup()

from django.conf import settings
from arena.models import ArenaSchedule, Court, DiscountCode, GalleryItem, PricingConfig, User
from django.utils import timezone
from datetime import timedelta


def seed_structural_data():
    courts_data = [
        {"external_id": "court-1", "court_number": 1, "name": "Court 1", "price_per_hour": 400.00, "is_indoor": True, "surface_type": "Pickleball Court"},
        {"external_id": "court-2", "court_number": 2, "name": "Court 2", "price_per_hour": 400.00, "is_indoor": True, "surface_type": "Pickleball Court"},
        {"external_id": "court-3", "court_number": 3, "name": "Court 3", "price_per_hour": 400.00, "is_indoor": False, "surface_type": "Pickleball Court"},
    ]
    if Court.objects.count() == 0:
        for c_data in courts_data:
            court, created = Court.objects.get_or_create(name=c_data["name"], defaults=c_data)
            print(f"[{'CREATED' if created else 'EXISTS'}] Court: {court.name}")
    else:
        print(f"[SKIPPED] Courts already present ({Court.objects.count()})")

    PricingConfig.get_current()

    ArenaSchedule.objects.get_or_create(
        date='DEFAULT',
        defaults={'is_closed': False, 'open_time': '06:00', 'close_time': '23:00'},
    )

    if GalleryItem.objects.count() == 0:
        gallery_data = [
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
                "title": "Official Pro Carbon Paddles",
                "item_type": "image",
                "category": "gear",
                "tag": "Pro Gear",
                "media_url": "/images/gallery-grid-full.jpg",
                "aspect": "square",
                "caption": "Carbon fiber paddles and court balls available at reception.",
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
        for g_data in gallery_data:
            GalleryItem.objects.get_or_create(external_id=g_data["external_id"], defaults=g_data)
        print(f"[CREATED] Seeded {len(gallery_data)} default gallery items")

    if DiscountCode.objects.count() == 0:
        valid_until = timezone.now() + timedelta(days=365)
        DiscountCode.objects.get_or_create(
            code="FIRSTGAME",
            defaults={
                "external_id": "disc-first",
                "discount_type": "FLAT",
                "value": 100,
                "min_booking_amount": 400,
                "max_usage": 500,
                "valid_to": valid_until,
                "is_active": True,
            },
        )
        DiscountCode.objects.get_or_create(
            code="BOSS15",
            defaults={
                "external_id": "disc-boss15",
                "discount_type": "PERCENT",
                "value": 15,
                "min_booking_amount": 400,
                "max_usage": 1000,
                "valid_to": valid_until,
                "is_active": True,
            },
        )


def seed_demo_users():
    if not settings.DEBUG:
        raise RuntimeError("Refusing to seed default demo user accounts when DJANGO_DEBUG=False.")

    demo_accounts = [
        {
            "username": "owner",
            "external_id": "usr-owner-01",
            "email": "owner@boss.com",
            "phone": "9999999999",
            "role": "OWNER",
            "is_staff": True,
            "is_superuser": True,
            "first_name": "Hiren",
            "last_name": "Patel (Owner)",
            "password": os.getenv("SEED_OWNER_PASSWORD", "BossOwner@2026"),
        },
        {
            "username": "staff",
            "external_id": "usr-emp-01",
            "email": "staff@boss.com",
            "phone": "8888888888",
            "role": "EMPLOYEE",
            "is_staff": True,
            "is_superuser": False,
            "first_name": "Karan",
            "last_name": "Desai (Staff Desk)",
            "password": os.getenv("SEED_STAFF_PASSWORD", "BossStaff@2026"),
        },
        {
            "username": "player",
            "external_id": "usr-cust-01",
            "email": "player@boss.com",
            "phone": "9876543210",
            "role": "CUSTOMER",
            "is_staff": False,
            "is_superuser": False,
            "first_name": "Vikram",
            "last_name": "Singhania (Player)",
            "password": os.getenv("SEED_PLAYER_PASSWORD", "BossPlayer@2026"),
        },
    ]

    for acc in demo_accounts:
        user, created = User.objects.get_or_create(
            username=acc["username"],
            defaults={
                "external_id": acc["external_id"],
                "email": acc["email"],
                "phone": acc["phone"],
                "role": acc["role"],
                "is_staff": acc["is_staff"],
                "is_superuser": acc["is_superuser"],
                "first_name": acc["first_name"],
                "last_name": acc["last_name"],
            },
        )
        if created:
            user.set_password(acc["password"])
            user.save()
        print(f"[{'CREATED' if created else 'EXISTS'}] Demo account: {user.username} ({user.role})")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Seed Boss Arena structural defaults and optional dev demo accounts.')
    parser.add_argument('--structural-only', action='store_true', help='Seed only structural defaults (no demo users).')
    parser.add_argument('--include-demo-users', action='store_true', help='Also create dev demo users if DEBUG=True.')
    args = parser.parse_args()

    seed_structural_data()
    if args.include_demo_users and not args.structural_only:
        seed_demo_users()
    print("Seed completed safely.")
