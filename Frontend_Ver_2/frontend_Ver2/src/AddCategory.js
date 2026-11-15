import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';

// หน้าเพิ่มหมวดหมู่ (สำหรับแอดมิน) มี 2 ช่องแยกกัน:
//   - genre = แนวเพลง เช่น Pop, Rock  (บันทึกลงตาราง Genre)
//   - mood  = อารมณ์เพลง เช่น เศร้า, สนุก (บันทึกลงตาราง Mood)
// หมวดที่เพิ่มแล้วจะไปเป็นตัวเลือกในหน้า AddSong และตัวกรองในหน้า Homeuser

// API อ่าน (GET) และเพิ่ม (POST) แนวเพลง / อารมณ์เพลง
const GENRE_URL = 'https://lyriseek-api-database.onrender.com/Genre';
const MOOD_URL = 'https://lyriseek-api-database.onrender.com/Mood';

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

const AddCategory = ({ navigation }) => {
    const [genreName, setGenreName] = useState('');               // ชื่อ genre ที่กำลังพิมพ์
    const [moodName, setMoodName] = useState('');                 // ชื่อ mood ที่กำลังพิมพ์
    const [submittingGenre, setSubmittingGenre] = useState(false); // true ระหว่างบันทึก genre
    const [submittingMood, setSubmittingMood] = useState(false);   // true ระหว่างบันทึก mood

    // รายการ genre และ mood ที่มีอยู่แล้วในระบบ ใช้ทำคำแนะนำและเช็กชื่อซ้ำ
    const [genreList, setGenreList] = useState([]);
    const [moodList, setMoodList] = useState([]);

    // ตอนเปิดหน้า: โหลด genre และ mood ที่มีอยู่แล้วทั้งหมดมาเก็บไว้
    useEffect(() => {
        fetchWithTimeout(GENRE_URL)
            .then((res) => res.json())
            .then((json) => setGenreList(json.data || []))
            .catch((err) => console.log('โหลด genre ไม่สำเร็จ:', err));

        fetchWithTimeout(MOOD_URL)
            .then((res) => res.json())
            .then((json) => setMoodList(json.data || []))
            .catch((err) => console.log('โหลด mood ไม่สำเร็จ:', err));
    }, []);

    // คำแนะนำระหว่างพิมพ์: แสดงชื่อที่มีอยู่แล้วซึ่งมีคำที่พิมพ์อยู่ข้างใน
    // เทียบแบบไม่สนตัวพิมพ์เล็ก-ใหญ่ (toLowerCase) เช่น พิมพ์ "po" จะเจอ "Pop"
    // ช่วยให้แอดมินเห็นว่ามีหมวดนี้อยู่แล้ว จะได้ไม่เพิ่มซ้ำ
    // ถ้าช่องยังว่างอยู่ ไม่ต้องแสดงคำแนะนำ
    const genreSuggestions = genreName.trim()
        ? genreList.filter((g) => g.genre_name.toLowerCase().includes(genreName.trim().toLowerCase()))
        : [];
    const moodSuggestions = moodName.trim()
        ? moodList.filter((m) => m.mood_name.toLowerCase().includes(moodName.trim().toLowerCase()))
        : [];

    // กดเพิ่ม genre:
    //   1) ถ้าช่องว่าง ให้เตือนแล้วหยุด
    //   2) ถ้ามีชื่อนี้อยู่แล้ว (ไม่สนตัวพิมพ์เล็ก-ใหญ่) จะไม่ส่งไป server เพื่อกันข้อมูลซ้ำ
    //      แต่ยังแจ้งว่าเพิ่มสำเร็จ เพราะผลลัพธ์ที่แอดมินต้องการ (มีหมวดนี้ในระบบ) เป็นจริงอยู่แล้ว
    //   3) ถ้าเป็นชื่อใหม่ ส่งไปบันทึกในตาราง Genre
    //      สำเร็จแล้วเพิ่มชื่อนี้ในรายการบนเครื่องทันที (คำแนะนำครั้งถัดไปจะเห็น) และล้างช่องพิมพ์
    const handleAddGenre = async () => {
        const name = genreName.trim();
        if (!name) {
            Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อ genre ก่อน');
            return;
        }

        const alreadyExists = genreList.some((g) => g.genre_name.toLowerCase() === name.toLowerCase());
        if (alreadyExists) {
            Alert.alert('สำเร็จ', `เพิ่ม genre "${name}" เรียบร้อยแล้ว`);
            setGenreName('');
            return;
        }

        setSubmittingGenre(true);
        try {
            const res = await fetchWithTimeout(GENRE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ genre_name: name }),
            });
            const json = await res.json();

            if (json.status === 'success') {
                Alert.alert('สำเร็จ', `เพิ่ม genre "${name}" เรียบร้อยแล้ว`);
                setGenreList((prev) => [...prev, { genre_id: json.genre_id, genre_name: name }]);
                setGenreName('');
            } else {
                Alert.alert('เพิ่ม genre ไม่สำเร็จ', json.error || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ');
            }
        } catch (err) {
            console.log('เพิ่ม genre ไม่สำเร็จ:', err);
            Alert.alert('เพิ่ม genre ไม่สำเร็จ', 'เชื่อมต่อ server ไม่ได้ ลองใหม่อีกครั้ง');
        } finally {
            setSubmittingGenre(false);
        }
    };

    // กดเพิ่ม mood: ทำงานแบบเดียวกับ handleAddGenre แต่บันทึกลงตาราง Mood
    const handleAddMood = async () => {
        const name = moodName.trim();
        if (!name) {
            Alert.alert('แจ้งเตือน', 'กรุณากรอกชื่อ mood ก่อน');
            return;
        }

        const alreadyExists = moodList.some((m) => m.mood_name.toLowerCase() === name.toLowerCase());
        if (alreadyExists) {
            Alert.alert('สำเร็จ', `เพิ่ม mood "${name}" เรียบร้อยแล้ว`);
            setMoodName('');
            return;
        }

        setSubmittingMood(true);
        try {
            const res = await fetchWithTimeout(MOOD_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mood_name: name }),
            });
            const json = await res.json();

            if (json.status === 'success') {
                Alert.alert('สำเร็จ', `เพิ่ม mood "${name}" เรียบร้อยแล้ว`);
                setMoodList((prev) => [...prev, { mood_id: json.mood_id, mood_name: name }]);
                setMoodName('');
            } else {
                Alert.alert('เพิ่ม mood ไม่สำเร็จ', json.error || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ');
            }
        } catch (err) {
            console.log('เพิ่ม mood ไม่สำเร็จ:', err);
            Alert.alert('เพิ่ม mood ไม่สำเร็จ', 'เชื่อมต่อ server ไม่ได้ ลองใหม่อีกครั้ง');
        } finally {
            setSubmittingMood(false);
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

                <Text style={styles.screenTitle}>Add Category</Text>

                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Genre</Text>
                    <View style={styles.inputBox}>
                        <TextInput
                            style={styles.input}
                            placeholder=""
                            placeholderTextColor="#666666"
                            value={genreName}
                            onChangeText={setGenreName}
                        />
                    </View>

                    {genreSuggestions.length > 0 && (
                        <View style={styles.suggestionBox}>
                            {genreSuggestions.map((g) => (
                                <View key={g.genre_id} style={styles.suggestionRow}>
                                    <Feather name="search" size={16} color="#666666" style={styles.suggestionIcon} />
                                    <View>
                                        <Text style={styles.suggestionText}>{g.genre_name}</Text>
                                        <Text style={styles.suggestionSubtext}>มีอยู่แล้วในระบบ</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    <TouchableOpacity
                        style={styles.addButton}
                        activeOpacity={0.85}
                        onPress={handleAddGenre}
                        disabled={submittingGenre}
                    >
                        {submittingGenre ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.addButtonText}>Add</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Mood</Text>
                    <View style={styles.inputBox}>
                        <TextInput
                            style={styles.input}
                            placeholder=""
                            placeholderTextColor="#666666"
                            value={moodName}
                            onChangeText={setMoodName}
                        />
                    </View>

                    {moodSuggestions.length > 0 && (
                        <View style={styles.suggestionBox}>
                            {moodSuggestions.map((m) => (
                                <View key={m.mood_id} style={styles.suggestionRow}>
                                    <Feather name="search" size={16} color="#666666" style={styles.suggestionIcon} />
                                    <View>
                                        <Text style={styles.suggestionText}>{m.mood_name}</Text>
                                        <Text style={styles.suggestionSubtext}>มีอยู่แล้วในระบบ</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    <TouchableOpacity
                        style={styles.addButton}
                        activeOpacity={0.85}
                        onPress={handleAddMood}
                        disabled={submittingMood}
                    >
                        {submittingMood ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.addButtonText}>Add</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
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
        marginBottom: 24,
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
    screenTitle: {
        fontSize: 34,
        fontWeight: 'bold',
        color: '#556AB0',
        textAlign: 'center',
        marginBottom: 32,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 22,
        paddingBottom: 20,
        marginBottom: 20,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        alignItems: 'center',
    },
    cardLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        alignSelf: 'flex-start',
        marginBottom: 14,
        marginLeft: 4,
    },
    inputBox: {
        width: '100%',
        backgroundColor: '#CED9FE',
        borderRadius: 14,
        height: 52,
        paddingHorizontal: 16,
        justifyContent: 'center',
        marginBottom: 16,
    },
    input: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E1E1E',
        height: '100%',
    },
    suggestionBox: {
        width: '100%',
        backgroundColor: '#F8F9FD',
        borderRadius: 12,
        marginTop: -8,
        marginBottom: 16,
        paddingVertical: 4,
    },
    suggestionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    suggestionIcon: {
        marginRight: 10,
    },
    suggestionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E1E1E',
    },
    suggestionSubtext: {
        fontSize: 12,
        color: '#888888',
        marginTop: 1,
    },
    addButton: {
        backgroundColor: '#9BAEFF',
        borderRadius: 10,
        paddingVertical: 7,
        paddingHorizontal: 26,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#9BAEFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 2,
    },
    addButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default AddCategory;
