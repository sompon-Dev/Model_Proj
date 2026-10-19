import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';

const TRAIN_SONG_URL = 'http://192.168.1.5:8000/Train_Song'; // ⚠️ เปลี่ยน IP เป็นของเครื่อง Server (Backend_Database/main.py) ถ้าเปลี่ยนเครื่อง
const UPDATE_MODEL_URL = 'http://192.168.1.5:8000/Train_Song/update_model'; // ⚠️ IP เดียวกับ TRAIN_SONG_URL

// เรียก fetch พร้อม timeout กันหน้าค้างถ้า server ไม่ตอบ (เหมือนที่ทำไว้ใน Homeuser.js/AddSong.js)
const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
};

const UpdateModel = ({ navigation }) => {
    const [songList, setSongList] = useState([]); // [{ newsong_id, newsong_name, newsong_artist }, ...]
    const [loaded, setLoaded] = useState(false); // true หลังโหลดเสร็จครั้งแรก (กันขึ้น "ไม่พบ" ก่อนโหลดเสร็จ)
    const [selectedIds, setSelectedIds] = useState([]); // newsong_id ที่ admin ติ๊กไว้ (เลือกได้หลายเพลง)
    const [submitting, setSubmitting] = useState(false);

    // โหลดรายชื่อเพลงทั้งหมดในตาราง Train_Song ตอนเปิดหน้านี้
    useEffect(() => {
        fetchWithTimeout(TRAIN_SONG_URL)
            .then((res) => res.json())
            .then((json) => setSongList(json.data || []))
            .catch((err) => console.log('โหลดเพลงจาก Train_Song ไม่สำเร็จ:', err))
            .finally(() => setLoaded(true));
    }, []);

    // ติ๊ก/ถอนติ๊กเพลงในรายการ (เหมือน checkbox)
    const toggleSong = (newsongId) => {
        setSelectedIds((prev) =>
            prev.includes(newsongId)
                ? prev.filter((id) => id !== newsongId)
                : [...prev, newsongId]
        );
    };

    // กดปุ่ม Enter: เอาเพลงที่ติ๊กไว้ไปเทรนเข้าโมเดล Ver.5 (ขั้นตอนนี้ช้า เพราะต้องโหลดโมเดล E5 +
    // encode เพลงใหม่ ตั้ง timeout ไว้นานหน่อย 5 นาที กันค้างแต่ก็ไม่ตัดจบเร็วเกินไป)
    const handleUpdateModel = () => {
        if (selectedIds.length === 0) {
            Alert.alert('แจ้งเตือน', 'กรุณาติ๊กเลือกเพลงอย่างน้อย 1 เพลงก่อน');
            return;
        }

        Alert.alert(
            'ยืนยันอัปเดตโมเดล',
            `จะนำเพลงที่ติ๊กไว้ ${selectedIds.length} เพลง ไปเทรนเข้าโมเดล แล้วลบออกจากรายการนี้ ต้องการดำเนินการต่อหรือไม่?`,
            [
                { text: 'ยกเลิก', style: 'cancel' },
                { text: 'ยืนยัน', onPress: submitUpdateModel },
            ]
        );
    };

    const submitUpdateModel = async () => {
        setSubmitting(true);
        try {
            const res = await fetchWithTimeout(
                UPDATE_MODEL_URL,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newsong_ids: selectedIds }),
                },
                300000
            );
            const json = await res.json();

            if (json.status === 'success') {
                Alert.alert('สำเร็จ', `เทรนเพลงเข้าโมเดลเรียบร้อยแล้ว ${json.trained_song_ids.length} เพลง`);
                setSongList((prev) => prev.filter((item) => !selectedIds.includes(item.newsong_id)));
                setSelectedIds([]);
            } else {
                Alert.alert('อัปเดตโมเดลไม่สำเร็จ', json.error || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ');
            }
        } catch (err) {
            console.log('อัปเดตโมเดลไม่สำเร็จ:', err);
            Alert.alert('อัปเดตโมเดลไม่สำเร็จ', 'เชื่อมต่อ server ไม่ได้ หรือใช้เวลานานเกินไป ลองใหม่อีกครั้ง');
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
                {/* Header */}
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

                {/* Screen Title */}
                <Text style={styles.screenTitle}>Update Model</Text>

                {/* White Container */}
                <View style={styles.cardContainer}>
                    {/* Song Checklist: ดึงมาจากตาราง Train_Song จริง ติ๊กเลือกได้หลายเพลง เลื่อนดูเพลงอื่นได้
                        ถ้าไม่มีเพลงเลยให้ขึ้น "ไม่พบ" */}
                    {loaded && songList.length === 0 ? (
                        <Text style={styles.notFoundText}>ไม่พบเพลงในระบบ</Text>
                    ) : (
                        <ScrollView style={styles.listContainer} nestedScrollEnabled>
                            {songList.map((item) => {
                                const isChecked = selectedIds.includes(item.newsong_id);
                                return (
                                    <TouchableOpacity
                                        key={item.newsong_id}
                                        style={styles.songItem}
                                        activeOpacity={0.7}
                                        onPress={() => toggleSong(item.newsong_id)}
                                    >
                                        {/* Placeholder Box for Image */}
                                        <View style={styles.imagePlaceholder} />

                                        {/* Song Title */}
                                        <Text style={styles.songTitle} numberOfLines={2}>
                                            {item.newsong_artist} - {item.newsong_name}
                                        </Text>

                                        {/* Checkbox */}
                                        <Feather
                                            name={isChecked ? 'check-square' : 'square'}
                                            size={22}
                                            color={isChecked ? '#556AB0' : '#9CA3AF'}
                                        />
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    )}

                    {/* Enter Button: เอาเพลงที่ติ๊กไว้ไปเทรนเข้าโมเดล */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={styles.enterButton}
                            activeOpacity={0.85}
                            onPress={handleUpdateModel}
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
        fontSize: 32,
        fontWeight: 'bold',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 28,
    },
    cardContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        paddingHorizontal: 20,
        paddingTop: 28,
        paddingBottom: 32,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
        minHeight: 460,
        justifyContent: 'space-between',
    },
    listContainer: {
        width: '100%',
        maxHeight: 360,
    },
    notFoundText: {
        fontSize: 15,
        color: '#888888',
        textAlign: 'center',
        marginTop: 40,
    },
    songItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 26,
    },
    imagePlaceholder: {
        width: 72,
        height: 60,
        backgroundColor: '#E2E8F0',
        borderRadius: 6,
        marginRight: 16,
    },
    songTitle: {
        flex: 1,
        fontSize: 15,
        fontWeight: 'bold',
        color: '#111827',
        lineHeight: 22,
    },
    buttonContainer: {
        alignItems: 'center',
        marginTop: 20,
    },
    enterButton: {
        backgroundColor: '#98A6FE',
        borderRadius: 14,
        height: 48,
        minWidth: 140,
        paddingHorizontal: 36,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#98A6FE',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
    },
    enterButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
});

export default UpdateModel;
