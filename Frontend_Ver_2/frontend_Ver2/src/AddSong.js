import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Modal,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';

const GENRE_URL = 'https://lyriseek-api-database.onrender.com/Genre'; // ⚠️ เปลี่ยน IP เป็นของเครื่อง Server (Backend_Database/main.py) ถ้าเปลี่ยนเครื่อง
const MOOD_URL = 'https://lyriseek-api-database.onrender.com/Mood'; // ⚠️ IP เดียวกับ GENRE_URL
const ADD_SONG_URL = 'https://lyriseek-api-database.onrender.com/AddSong'; // ⚠️ IP เดียวกับ GENRE_URL

// เรียก fetch พร้อม timeout กันหน้าค้างถ้า server ไม่ตอบ (เหมือนที่ทำไว้ใน Homeuser.js)
const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
};

const AddSong = ({ navigation }) => {
    const [songName, setSongName] = useState('');
    const [artist, setArtist] = useState('');
    const [lyrics, setLyrics] = useState('');
    const [youtubeLink, setYoutubeLink] = useState('');
    const [spotifyLink, setSpotifyLink] = useState('');

    const [genreList, setGenreList] = useState([]); // [{ genre_id, genre_name }, ...]
    const [moodList, setMoodList] = useState([]); // [{ mood_id, mood_name }, ...]
    const [selectedGenres, setSelectedGenres] = useState([]); // ชื่อ genre ที่ติ๊กไว้
    const [selectedMoods, setSelectedMoods] = useState([]); // ชื่อ mood ที่ติ๊กไว้
    const [genreSearch, setGenreSearch] = useState(''); // ช่อง search บนสุดของ modal genre
    const [moodSearch, setMoodSearch] = useState(''); // ช่อง search บนสุดของ modal mood

    const [genreModalVisible, setGenreModalVisible] = useState(false);
    const [moodModalVisible, setMoodModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // กดเปิด dropdown genre: โหลดรายชื่อ genre จาก server (โหลดครั้งแรกครั้งเดียว) แล้วเปิด modal
    const openGenreModal = () => {
        setGenreModalVisible(true);
        if (genreList.length === 0) {
            fetchWithTimeout(GENRE_URL)
                .then((res) => res.json())
                .then((json) => setGenreList(json.data || []))
                .catch((err) => console.log('โหลด genre ไม่สำเร็จ:', err));
        }
    };

    // กดเปิด dropdown mood: โหลดรายชื่อ mood จาก server (โหลดครั้งแรกครั้งเดียว) แล้วเปิด modal
    const openMoodModal = () => {
        setMoodModalVisible(true);
        if (moodList.length === 0) {
            fetchWithTimeout(MOOD_URL)
                .then((res) => res.json())
                .then((json) => setMoodList(json.data || []))
                .catch((err) => console.log('โหลด mood ไม่สำเร็จ:', err));
        }
    };

    // ติ๊ก/ถอนติ๊ก genre ในรายการที่เลือกไว้ (เหมือน checkbox)
    const toggleGenre = (genreName) => {
        setSelectedGenres((prev) =>
            prev.includes(genreName)
                ? prev.filter((name) => name !== genreName)
                : [...prev, genreName]
        );
    };

    // ติ๊ก/ถอนติ๊ก mood ในรายการที่เลือกไว้ (เหมือน checkbox)
    const toggleMood = (moodName) => {
        setSelectedMoods((prev) =>
            prev.includes(moodName)
                ? prev.filter((name) => name !== moodName)
                : [...prev, moodName]
        );
    };

    // กดปุ่ม Enter: ส่งข้อมูลเพลงทั้งหมดไปที่ /AddSong ให้เพิ่มลง database ให้ครบทุกตาราง
    const handleSubmit = async () => {
        if (!songName.trim() || !artist.trim() || !lyrics.trim()) {
            Alert.alert('แจ้งเตือน', 'กรุณากรอก Song name, Artist, และ Lyrics ให้ครบ');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetchWithTimeout(ADD_SONG_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    song_name: songName.trim(),
                    artist: artist.trim(),
                    lyric: lyrics.trim(),
                    song_genre: selectedGenres,
                    song_mood: selectedMoods,
                    youtube_link: youtubeLink.trim(),
                    spotify_link: spotifyLink.trim(),
                }),
            });
            const json = await res.json();

            if (json.status === 'success') {
                // ถ้า backend ดึงรูป thumbnail จากลิงก์ YouTube ไม่ได้ (เช่น ใส่ลิงก์เพลย์ลิสต์มา)
                // จะมี image_warning ติดมาด้วย — เพลงเพิ่มสำเร็จแล้ว แค่แจ้งเตือนเรื่องรูปเพิ่ม
                if (json.image_warning) {
                    Alert.alert('เพิ่มเพลงสำเร็จ แต่ไม่พบรูปภาพ', json.image_warning);
                } else {
                    Alert.alert('สำเร็จ', 'เพิ่มเพลงเรียบร้อยแล้ว');
                }
                navigation?.goBack();
            } else {
                Alert.alert('เพิ่มเพลงไม่สำเร็จ', json.error || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ');
            }
        } catch (err) {
            console.log('เพิ่มเพลงไม่สำเร็จ:', err);
            Alert.alert('เพิ่มเพลงไม่สำเร็จ', 'เชื่อมต่อ server ไม่ได้ ลองใหม่อีกครั้ง');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header (Back button on left, Avatar on right) */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.circleButton}
                        activeOpacity={0.7}
                        onPress={() => navigation?.goBack()}
                    >
                        <Feather name="arrow-left" size={24} color="#1E1E1E" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.circleButton}
                        activeOpacity={0.7}
                        onPress={() => navigation?.navigate('Login')}
                    >
                        <Feather name="user" size={24} color="#1E1E1E" />
                    </TouchableOpacity>
                </View>

                {/* Form Card Container */}
                <View style={styles.cardContainer}>
                    <Text style={styles.formTitle}>Add Song</Text>

                    {/* Song name */}
                    <View style={styles.inputBox}>
                        <TextInput
                            style={styles.input}
                            placeholder="Song name"
                            placeholderTextColor="#2D3748"
                            value={songName}
                            onChangeText={setSongName}
                        />
                    </View>

                    {/* Artist */}
                    <View style={styles.inputBox}>
                        <TextInput
                            style={styles.input}
                            placeholder="Artist"
                            placeholderTextColor="#2D3748"
                            value={artist}
                            onChangeText={setArtist}
                        />
                    </View>

                    {/* Link YouTube — ไม่กรอกก็ได้ ส่งเป็นค่าว่างไปก่อน */}
                    <View style={styles.inputBox}>
                        <TextInput
                            style={styles.input}
                            placeholder="Link YouTube — ไม่บังคับ"
                            placeholderTextColor="#2D3748"
                            value={youtubeLink}
                            onChangeText={setYoutubeLink}
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Link Spotify — ไม่กรอกก็ได้ ส่งเป็นค่าว่างไปก่อน */}
                    <View style={styles.inputBox}>
                        <TextInput
                            style={styles.input}
                            placeholder="Link Spotify — ไม่บังคับ"
                            placeholderTextColor="#2D3748"
                            value={spotifyLink}
                            onChangeText={setSpotifyLink}
                            autoCapitalize="none"
                        />
                    </View>

                    {/* Lyrics */}
                    <View style={[styles.inputBox, styles.lyricsBox]}>
                        <TextInput
                            style={[styles.input, styles.lyricsInput]}
                            placeholder="Lyrics"
                            placeholderTextColor="#2D3748"
                            multiline
                            textAlignVertical="top"
                            value={lyrics}
                            onChangeText={setLyrics}
                        />
                    </View>

                    {/* Genre Dropdown Trigger */}
                    <TouchableOpacity
                        style={[styles.inputBox, styles.dropdownBox]}
                        activeOpacity={0.8}
                        onPress={openGenreModal}
                    >
                        <Text style={[styles.dropdownText, styles.placeholderText]}>
                            {selectedGenres.length > 0 ? selectedGenres.join(', ') : 'Genre'}
                        </Text>
                        <Feather name="chevron-down" size={24} color="#1E1E1E" />
                    </TouchableOpacity>

                    {/* Mood Dropdown Trigger */}
                    <TouchableOpacity
                        style={[styles.inputBox, styles.dropdownBox]}
                        activeOpacity={0.8}
                        onPress={openMoodModal}
                    >
                        <Text style={[styles.dropdownText, styles.placeholderText]}>
                            {selectedMoods.length > 0 ? selectedMoods.join(', ') : 'Mood'}
                        </Text>
                        <Feather name="chevron-down" size={24} color="#1E1E1E" />
                    </TouchableOpacity>

                    {/* Enter Button */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={styles.enterButton}
                            activeOpacity={0.85}
                            onPress={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.enterButtonText}>Enter</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* Genre Modal: ติ๊กเลือกได้หลาย genre */}
            <Modal
                visible={genreModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setGenreModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setGenreModalVisible(false)}
                >
                    <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                        <Text style={styles.modalTitle}>เลือก Genre</Text>
                        <TextInput
                            style={styles.modalSearchInput}
                            placeholder="Search genre"
                            placeholderTextColor="#999999"
                            value={genreSearch}
                            onChangeText={setGenreSearch}
                        />
                        <ScrollView style={styles.modalScroll}>
                            {genreList
                                .filter((genre) =>
                                    genre.genre_name.toLowerCase().includes(genreSearch.toLowerCase())
                                )
                                .map((genre) => {
                                    const isChecked = selectedGenres.includes(genre.genre_name);
                                    return (
                                        <TouchableOpacity
                                            key={genre.genre_id}
                                            style={[styles.modalItem, isChecked && styles.modalItemSelected]}
                                            onPress={() => toggleGenre(genre.genre_name)}
                                        >
                                            <Text
                                                style={[
                                                    styles.modalItemText,
                                                    isChecked && styles.modalItemTextSelected,
                                                ]}
                                            >
                                                {genre.genre_name}
                                            </Text>
                                            <Feather
                                                name={isChecked ? 'check-square' : 'square'}
                                                size={20}
                                                color={isChecked ? '#4A60A4' : '#9CA3AF'}
                                            />
                                        </TouchableOpacity>
                                    );
                                })}
                        </ScrollView>
                        <TouchableOpacity
                            style={styles.modalDoneButton}
                            onPress={() => setGenreModalVisible(false)}
                        >
                            <Text style={styles.modalDoneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Mood Modal: ติ๊กเลือกได้หลาย mood */}
            <Modal
                visible={moodModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setMoodModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setMoodModalVisible(false)}
                >
                    <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                        <Text style={styles.modalTitle}>เลือก Mood</Text>
                        <TextInput
                            style={styles.modalSearchInput}
                            placeholder="Search mood"
                            placeholderTextColor="#999999"
                            value={moodSearch}
                            onChangeText={setMoodSearch}
                        />
                        <ScrollView style={styles.modalScroll}>
                            {moodList
                                .filter((mood) =>
                                    mood.mood_name.toLowerCase().includes(moodSearch.toLowerCase())
                                )
                                .map((mood) => {
                                    const isChecked = selectedMoods.includes(mood.mood_name);
                                    return (
                                        <TouchableOpacity
                                            key={mood.mood_id}
                                            style={[styles.modalItem, isChecked && styles.modalItemSelected]}
                                            onPress={() => toggleMood(mood.mood_name)}
                                        >
                                            <Text
                                                style={[
                                                    styles.modalItemText,
                                                    isChecked && styles.modalItemTextSelected,
                                                ]}
                                            >
                                                {mood.mood_name}
                                            </Text>
                                            <Feather
                                                name={isChecked ? 'check-square' : 'square'}
                                                size={20}
                                                color={isChecked ? '#4A60A4' : '#9CA3AF'}
                                            />
                                        </TouchableOpacity>
                                    );
                                })}
                        </ScrollView>
                        <TouchableOpacity
                            style={styles.modalDoneButton}
                            onPress={() => setMoodModalVisible(false)}
                        >
                            <Text style={styles.modalDoneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FD',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    circleButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E8ECF2',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
    },
    cardContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        paddingHorizontal: 20,
        paddingVertical: 26,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    formTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 22,
    },
    inputBox: {
        backgroundColor: '#D1DCFE',
        borderRadius: 14,
        paddingHorizontal: 18,
        height: 52,
        justifyContent: 'center',
        marginBottom: 16,
    },
    input: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E1E1E',
    },
    lyricsBox: {
        height: 160,
        paddingVertical: 14,
    },
    lyricsInput: {
        height: '100%',
        lineHeight: 22,
    },
    dropdownBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dropdownText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E1E1E',
    },
    placeholderText: {
        color: '#1E1E1E',
    },
    buttonContainer: {
        alignItems: 'center',
        marginTop: 18,
        marginBottom: 6,
    },
    enterButton: {
        backgroundColor: '#91AAFD',
        borderRadius: 24,
        height: 48,
        minWidth: 140,
        paddingHorizontal: 36,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#91AAFD',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 3,
    },
    enterButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 28,
    },
    modalContent: {
        width: '100%',
        maxHeight: '60%',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 14,
        textAlign: 'center',
    },
    modalSearchInput: {
        backgroundColor: '#F3F4F6',
        borderWidth: 1.5,
        borderColor: '#E8ECF2',
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 14,
        fontSize: 14,
        color: '#1E1E1E',
        marginBottom: 10,
    },
    modalScroll: {
        maxHeight: 280,
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    modalItemSelected: {
        backgroundColor: '#EFF3FF',
        borderRadius: 8,
    },
    modalItemText: {
        fontSize: 16,
        color: '#374151',
        fontWeight: '500',
    },
    modalItemTextSelected: {
        color: '#4A60A4',
        fontWeight: '700',
    },
    modalDoneButton: {
        marginTop: 14,
        backgroundColor: '#91AAFD',
        borderRadius: 14,
        paddingVertical: 10,
        alignItems: 'center',
    },
    modalDoneButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default AddSong;
