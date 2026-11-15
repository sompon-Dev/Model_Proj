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

// หน้าเพิ่มเพลงใหม่ (สำหรับแอดมิน)
// กดบันทึกแล้ว server (Render) จะเพิ่มข้อมูลลงหลายตารางในครั้งเดียว:
//   Song           ข้อมูลเพลง ชื่อ ศิลปิน ลิงก์ และรูปปก (ดึงจากลิงก์ YouTube ให้เอง)
//   Genre_Song     จับคู่เพลงกับแนวเพลงที่เลือก
//   Mood_Song      จับคู่เพลงกับอารมณ์เพลงที่เลือก
//   Train_Song     ใส่เพลงเข้าคิวรอฝึกเข้าโมเดล (แอดมินไปกดฝึกต่อในหน้า UpdateModel)
//   trending_song  สร้างแถวสถิติยอดฟังของเพลงนี้ เริ่มที่ 0
// ถ้าขั้นไหนพลาด server จะยกเลิกทั้งหมด (rollback) ไม่มีข้อมูลค้างครึ่งๆ กลางๆ

// API อ่านรายการแนวเพลงและอารมณ์เพลง
const GENRE_URL = 'https://lyriseek-api-database.onrender.com/Genre';
const MOOD_URL = 'https://lyriseek-api-database.onrender.com/Mood';
// API บันทึกเพลงใหม่
const ADD_SONG_URL = 'https://lyriseek-api-database.onrender.com/AddSong';

// fetch แบบมีเวลาหมดอายุ (ค่าเริ่มต้น 10 วินาที)
// ถ้า server ไม่ตอบภายในเวลาที่กำหนด จะยกเลิกคำขอให้เอง หน้าจอจะได้ไม่ค้าง
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
    // ค่าที่แอดมินกรอกในฟอร์ม
    const [songName, setSongName] = useState('');
    const [artist, setArtist] = useState('');
    const [lyrics, setLyrics] = useState('');
    const [youtubeLink, setYoutubeLink] = useState('');
    const [spotifyLink, setSpotifyLink] = useState(''); // หน้าจอยังไม่มีช่องกรอก จึงส่งเป็นค่าว่างเสมอ

    // แนวเพลงและอารมณ์เพลงที่มีในระบบ (โหลดตอนเปิดหน้าต่างเลือก)
    const [genreList, setGenreList] = useState([]);
    const [moodList, setMoodList] = useState([]);
    // ชื่อแนวเพลงและอารมณ์เพลงที่ติ๊กเลือกให้เพลงนี้ (เลือกได้หลายอัน)
    const [selectedGenres, setSelectedGenres] = useState([]);
    const [selectedMoods, setSelectedMoods] = useState([]);
    // คำค้นในช่องค้นหาของหน้าต่างเลือก genre / mood
    const [genreSearch, setGenreSearch] = useState('');
    const [moodSearch, setMoodSearch] = useState('');

    const [genreModalVisible, setGenreModalVisible] = useState(false); // หน้าต่างเลือก genre เปิดอยู่ไหม
    const [moodModalVisible, setMoodModalVisible] = useState(false);   // หน้าต่างเลือก mood เปิดอยู่ไหม
    const [submitting, setSubmitting] = useState(false);               // true ระหว่างกำลังบันทึกเพลง

    // เปิดหน้าต่างเลือก genre
    // โหลดรายการจาก server เฉพาะครั้งแรก ครั้งต่อไปใช้รายการที่โหลดไว้แล้ว ไม่ต้องโหลดซ้ำ
    const openGenreModal = () => {
        setGenreModalVisible(true);
        if (genreList.length === 0) {
            fetchWithTimeout(GENRE_URL)
                .then((res) => res.json())
                .then((json) => setGenreList(json.data || []))
                .catch((err) => console.log('โหลด genre ไม่สำเร็จ:', err));
        }
    };

    // เปิดหน้าต่างเลือก mood (ทำงานแบบเดียวกับ openGenreModal)
    const openMoodModal = () => {
        setMoodModalVisible(true);
        if (moodList.length === 0) {
            fetchWithTimeout(MOOD_URL)
                .then((res) => res.json())
                .then((json) => setMoodList(json.data || []))
                .catch((err) => console.log('โหลด mood ไม่สำเร็จ:', err));
        }
    };

    // ติ๊ก/ยกเลิกติ๊ก genre และ mood (ทำงานเหมือน checkbox)
    // เก็บเป็น "ชื่อ" ไม่ใช่ id เพราะ server รับชื่อแล้วไปหา id เอง (ถ้าไม่เจอชื่อนั้นจะสร้างหมวดใหม่ให้)
    const toggleGenre = (genreName) => {
        setSelectedGenres((prev) =>
            prev.includes(genreName)
                ? prev.filter((name) => name !== genreName)
                : [...prev, genreName]
        );
    };

    const toggleMood = (moodName) => {
        setSelectedMoods((prev) =>
            prev.includes(moodName)
                ? prev.filter((name) => name !== moodName)
                : [...prev, moodName]
        );
    };

    // กดปุ่มบันทึกเพลง
    // allowDuplicate = อนุญาตให้เพิ่มแม้เพลงอาจซ้ำ (ครั้งแรกเป็น false, ถ้าแอดมินกด "เพิ่มต่อไป" จะเรียกซ้ำด้วย true)
    // ขั้นตอน:
    //   1) ต้องกรอกชื่อเพลง ศิลปิน และเนื้อเพลงให้ครบ (ช่องอื่นเว้นว่างได้)
    //   2) ส่งข้อมูลทั้งหมดไปที่ server (ตัดช่องว่างหน้า-หลังออกก่อน)
    //   3) ดูคำตอบจาก server ซึ่งมี 3 แบบ:
    //        'duplicate' -> server เจอเพลงที่อาจซ้ำ จะยังไม่บันทึก
    //                       แสดงรายชื่อเพลงที่ซ้ำ ให้แอดมินเลือกยกเลิก หรือกด "เพิ่มต่อไป"
    //        'success'   -> บันทึกแล้ว ถ้าหารูปปกไม่เจอจะได้คำเตือนเพิ่ม (image_warning)
    //                       จากนั้นกลับไปหน้าเมนูแอดมิน
    //        อื่นๆ       -> แสดงข้อความ error จาก server
    const handleSubmit = async (allowDuplicate = false) => {
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
                    allow_duplicate: allowDuplicate,
                }),
            });
            const json = await res.json();

            if (json.status === 'duplicate') {
                const list = (json.duplicates || [])
                    .map((s) => `• ${s.song_name} — ${s.Artist || 'ไม่ระบุศิลปิน'} (id ${s.song_id})`)
                    .join('\n');
                Alert.alert('เพลงนี้อาจซ้ำกับเพลงที่มีอยู่แล้ว', `${list}\n\nต้องการเพิ่มต่อไปหรือไม่?`, [
                    { text: 'ยกเลิก', style: 'cancel' },
                    { text: 'เพิ่มต่อไป', onPress: () => handleSubmit(true) },
                ]);
            } else if (json.status === 'success') {
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
                        onPress={() => navigation?.navigate('AdminProfile')}
                    >
                        <Feather name="user" size={24} color="#1E1E1E" />
                    </TouchableOpacity>
                </View>

                <View style={styles.cardContainer}>
                    <Text style={styles.formTitle}>Add Song</Text>

                    <View style={styles.inputBox}>
                        <TextInput
                            style={styles.input}
                            placeholder="Song Name"
                            placeholderTextColor="#2D3748"
                            value={songName}
                            onChangeText={setSongName}
                        />
                    </View>

                    <View style={styles.inputBox}>
                        <TextInput
                            style={styles.input}
                            placeholder="Artist"
                            placeholderTextColor="#2D3748"
                            value={artist}
                            onChangeText={setArtist}
                        />
                    </View>

                    <View style={styles.inputBox}>
                        <TextInput
                            style={styles.input}
                            placeholder="Link YouTube"
                            placeholderTextColor="#2D3748"
                            value={youtubeLink}
                            onChangeText={setYoutubeLink}
                            autoCapitalize="none"
                        />
                    </View>
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

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={styles.enterButton}
                            activeOpacity={0.85}
                            onPress={() => handleSubmit(false)}
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
