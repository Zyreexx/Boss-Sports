import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'boss_backend.settings')
django.setup()

from arena.models import User, Court, Booking, GalleryItem


def run_seed():
    print("Seeding database...")

    # 1. Seed Owner (Admin)
    owner, created = User.objects.get_or_create(username='owner', defaults={
        'email': 'owner@boss.com',
        'phone': '9999999999',
        'role': 'OWNER',
        'is_staff': True,
        'is_superuser': True,
        'first_name': 'Hiren',
        'last_name': 'Patel (Owner)',
    })
    owner.set_password('BossOwner@2026')
    owner.save()
    print(f"[{'CREATED' if created else 'UPDATED'}] Owner: owner@boss.com / BossOwner@2026")

    # 2. Seed Staff (Desk)
    staff, created = User.objects.get_or_create(username='staff', defaults={
        'email': 'staff@boss.com',
        'phone': '8888888888',
        'role': 'EMPLOYEE',
        'is_staff': True,
        'first_name': 'Karan',
        'last_name': 'Desai (Desk Staff)',
    })
    staff.set_password('BossStaff@2026')
    staff.save()
    print(f"[{'CREATED' if created else 'UPDATED'}] Staff: staff@boss.com / BossStaff@2026")

    # 3. Seed Customer (Player)
    player, created = User.objects.get_or_create(username='player', defaults={
        'email': 'player@boss.com',
        'phone': '9876543210',
        'role': 'CUSTOMER',
        'first_name': 'Vikram',
        'last_name': 'Singhania (Player)',
    })
    player.set_password('BossPlayer@2026')
    player.save()
    print(f"[{'CREATED' if created else 'UPDATED'}] Player: player@boss.com / BossPlayer@2026")

    # 4. Seed Courts (3 Tournament Pickleball Courts)
    courts_data = [
        {"name": "Court 1", "price_per_hour": 400.00, "lighting_lux": 500, "surface_type": "Pro Acrylic Cushion"},
        {"name": "Court 2", "price_per_hour": 400.00, "lighting_lux": 500, "surface_type": "Pro Acrylic Cushion"},
        {"name": "Court 3", "price_per_hour": 400.00, "lighting_lux": 500, "surface_type": "Pro Acrylic Cushion"},
    ]
    for c_data in courts_data:
        court, created = Court.objects.get_or_create(name=c_data["name"], defaults=c_data)
        print(f"[{'CREATED' if created else 'EXISTS'}] Court: {court.name} (₹{court.price_per_hour}/hr)")

    # 5. Seed Gallery Items
    gallery_data = [
        {
            "title": "Championship Kitchen Dink Rally",
            "item_type": "video",
            "category": "matchplay",
            "media_url": "/images/hero-player.jpg",
            "video_url": "https://vjs.zencdn.net/v/oceans.mp4",
            "aspect": "tall",
            "caption": "Fast-paced third shot drop and kitchen rally exchanges on Court 1.",
            "order": 1,
        },
        {
            "title": "Official Pro Selkirk Carbon Paddles",
            "item_type": "image",
            "category": "gear",
            "media_url": "/images/gallery-grid-full.jpg",
            "video_url": None,
            "aspect": "square",
            "caption": "Complimentary USAPA tournament-grade carbon fiber paddles provided at reception.",
            "order": 2,
        },
        {
            "title": "Baseline Reset & Crosscourt Angle",
            "item_type": "video",
            "category": "training",
            "media_url": "/images/athletes-team.jpg",
            "video_url": "https://vjs.zencdn.net/v/oceans.mp4",
            "aspect": "tall",
            "caption": "Mastering the defensive baseline reset under intense topspin pressure.",
            "order": 3,
        },
        {
            "title": "Optic Yellow Tournament Ball in Flight",
            "item_type": "image",
            "category": "matchplay",
            "media_url": "/images/ball-hand.jpg",
            "video_url": None,
            "aspect": "standard",
            "caption": "High-visibility tournament optic balls engineered for consistent court bounce.",
            "order": 4,
        },
        {
            "title": "Precision Backhand Slice Grip",
            "item_type": "image",
            "category": "gear",
            "media_url": "/images/gallery-action-scroll.jpg",
            "video_url": None,
            "aspect": "tall",
            "caption": "Ergonomic moisture-wicking grip designed for maximum control and spin.",
            "order": 5,
        },
        {
            "title": "Overhead Smash & Jump Volley",
            "item_type": "video",
            "category": "tournament",
            "media_url": "/images/joola-court.jpg",
            "video_url": "https://vjs.zencdn.net/v/oceans.mp4",
            "aspect": "tall",
            "caption": "High-energy championship overhead smash in game point tiebreak.",
            "order": 6,
        },
    ]

    for g_data in gallery_data:
        g_item, created = GalleryItem.objects.get_or_create(title=g_data["title"], defaults=g_data)
        print(f"[{'CREATED' if created else 'EXISTS'}] Gallery: {g_item.title} ({g_item.item_type})")

    print("\nDatabase seeded successfully!")


if __name__ == '__main__':
    run_seed()
