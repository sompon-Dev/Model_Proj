
from main import (
    create_user, UserData,
    create_Train_Song, Train_SongData,
    create_Song, SongData,
    create_Genre, GenreData,
    create_Genre_Song, Genre_SongData,
    create_Mood, MoodData,
    create_Mood_Song, Mood_SongData,
)


def test_insert_user():
    data = UserData(
        username="test_user2",
        email="test_user1@example.com",
        password="123456",
    )
    print("[User] เพิ่มข้อมูลลงตาราง User -> username:", data.username, "| email:", data.email, "| password:", data.password)
    result = create_user(data)
    print("[User] insert result:", result)


def test_insert_train_song():
    data = Train_SongData(
        newsong_name="Test Song",
        newsong_artist="Test Artist",
        newsong_lyrics="la land",
    )
    print("[Train_Song] เพิ่มข้อมูลลงตาราง Train_Song -> newsong_name:", data.newsong_name, "| newsong_artist:", data.newsong_artist, "| newsong_lyrics:", data.newsong_lyrics)
    result = create_Train_Song(data)
    print("[Train_Song] insert result:", result)


def test_insert_song():
    data = SongData(
        song_name="Test Song",
        spotify_Link="https://open.spotify.com/track/xxxx",
        youtube_link="https://youtube.com/watch?v=xxxx",
    )
    print("[Song] เพิ่มข้อมูลลงตาราง Song -> song_name:", data.song_name, "| spotify_Link:", data.spotify_Link, "| youtube_link:", data.youtube_link)
    result = create_Song(data)
    print("[Song] insert result:", result)


def test_insert_genre():
    data = GenreData(genre_name="Pop")
    print("[Genre] เพิ่มข้อมูลลงตาราง Genre -> genre_name:", data.genre_name)
    result = create_Genre(data)
    print("[Genre] insert result:", result)


def test_insert_genre_song():
    data = Genre_SongData(song_id=1, genre_id=1)
    print("[Genre_Song] เพิ่มข้อมูลลงตาราง Genre_Song -> song_id:", data.song_id, "| genre_id:", data.genre_id)
    result = create_Genre_Song(data)
    print("[Genre_Song] insert result:", result)


def test_insert_mood():
    data = MoodData(mood_name="Happy")
    print("[Mood] เพิ่มข้อมูลลงตาราง Mood -> mood_name:", data.mood_name)
    result = create_Mood(data)
    print("[Mood] insert result:", result)


def test_insert_mood_song():
    data = Mood_SongData(song_id=1, mood_id=1)
    print("[Mood_Song] เพิ่มข้อมูลลงตาราง Mood_Song -> song_id:", data.song_id, "| mood_id:", data.mood_id)
    result = create_Mood_Song(data)
    print("[Mood_Song] insert result:", result)


if __name__ == "__main__":
    for name, test_func in [
        ("User", test_insert_user),
        ("Train_Song", test_insert_train_song),
        ("Song", test_insert_song),
        ("Genre", test_insert_genre),
        ("Genre_Song", test_insert_genre_song),
        ("Mood", test_insert_mood),
        ("Mood_Song", test_insert_mood_song),
    ]:
        try:
            test_func()
        except Exception as e:
            print(f"[{name}] insert FAILED: {e!r}")
