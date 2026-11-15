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

// ภาพรวมของหน้านี้ (เพิ่มเพลงใหม่เข้าโมเดลค้นหา):
//   ตอนแอดมินเพิ่มเพลงในหน้า AddSong ระบบจะใส่เพลงไว้ใน "คิวรอฝึก" (ตาราง Train_Song) ด้วย
//   เพลงในคิวนี้ยังค้นหาจากเนื้อร้องไม่เจอ จนกว่าแอดมินจะเลือกแล้วกด Update Model ในหน้านี้
//   ลำดับการทำงานหลังกด:
//     แอป -> Render (/Train_Song/update_model) -> Modal (/update_model)
//     Modal ตัดเนื้อเพลงเป็นท่อนๆ, แปลงเป็นเวกเตอร์ด้วยโมเดล E5, ต่อท้ายไฟล์ index เดิม แล้วโหลด index ใหม่
//     ทำเสร็จแล้ว Render จะลบเพลงที่ฝึกสำเร็จออกจากคิว Train_Song

// API อ่านรายการเพลงที่รอฝึก (ตาราง Train_Song)
const TRAIN_SONG_URL = 'https://lyriseek-api-database.onrender.com/Train_Song';
// API สั่งเริ่มฝึก และใช้ถามความคืบหน้า (ต่อท้ายด้วย /<job_id>)
const UPDATE_MODEL_URL = 'https://lyriseek-api-database.onrender.com/Train_Song/update_model';
// ถามความคืบหน้าทุก 3 วินาที
const UPDATE_MODEL_POLL_MS = 3000;
// รอได้นานสุด 6 นาที (Modal ตั้งเวลาให้ฝึกได้ 5 นาที เผื่อไว้อีก 1 นาที)
const UPDATE_MODEL_MAX_WAIT_MS = 360000;

// fetch แบบมีเวลาหมดอายุ (ค่าเริ่มต้น 10 วินาที)
// fetch ปกติจะรอไปเรื่อยๆ ถ้า server ไม่ตอบ หน้าจอจะค้าง
// ตัวนี้ใช้ AbortController ตั้งนาฬิกาไว้ ถ้าเกินเวลาจะยกเลิกคำขอให้เอง
// finally ใช้ล้างนาฬิกาทิ้งเสมอ ไม่ว่าคำขอจะสำเร็จหรือพลาด
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
    const [songList, setSongList] = useState([]);         // เพลงที่รอฝึกทั้งหมด (จาก Train_Song)
    const [loaded, setLoaded] = useState(false);          // true เมื่อโหลดเสร็จ (กันขึ้น "ไม่มีเพลง" ก่อนโหลดเสร็จ)
    const [selectedIds, setSelectedIds] = useState([]);   // newsong_id ของเพลงที่ติ๊กเลือก
    const [submitting, setSubmitting] = useState(false);  // true ระหว่างกำลังฝึกโมเดล (ปุ่มจะกดซ้ำไม่ได้)

    // ตอนเปิดหน้า: โหลดรายการเพลงที่รอฝึกมาแสดง
    useEffect(() => {
        fetchWithTimeout(TRAIN_SONG_URL)
            .then((res) => res.json())
            .then((json) => setSongList(json.data || []))
            .catch((err) => console.log('โหลดเพลงจาก Train_Song ไม่สำเร็จ:', err))
            .finally(() => setLoaded(true));
    }, []);

    // ติ๊ก/ยกเลิกติ๊กเพลง (ทำงานเหมือน checkbox)
    // ถ้าเพลงนี้ถูกเลือกอยู่แล้ว -> เอาออกจากรายการที่เลือก
    // ถ้ายังไม่ถูกเลือก -> เพิ่มเข้าไป
    const toggleSong = (newsongId) => {
        setSelectedIds((prev) =>
            prev.includes(newsongId)
                ? prev.filter((id) => id !== newsongId)
                : [...prev, newsongId]
        );
    };

    // กดปุ่ม Update Model:
    //   - ถ้ายังไม่ได้เลือกเพลงเลย ให้เตือนแล้วหยุด
    //   - ถ้าเลือกแล้ว ให้เด้งถามยืนยันก่อน เพราะเพลงที่ฝึกเสร็จจะถูกลบออกจากรายการนี้
    //     กดยืนยันแล้วจึงเรียก submitUpdateModel
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

    // รอจนกว่าการฝึกจะเสร็จ ด้วยการ "ถามซ้ำเป็นระยะ" (polling)
    // เหตุผล: การฝึกอาจใช้เวลาหลายนาที ถ้ารอคำตอบในคำขอเดียว การเชื่อมต่อจะหลุดก่อน
    // จึงให้ server เริ่มงานแล้วตอบ job_id กลับมาทันที จากนั้นแอปค่อยถามสถานะทุก 3 วินาที
    //   - status ยังเป็น 'running' -> รอแล้วถามใหม่
    //   - status เป็นอย่างอื่น ('success' หรือ 'error') -> คืนผลนั้นออกไป
    //   - ถามแล้วเน็ตพลาด -> ไม่ยอมแพ้ ลองถามใหม่รอบหน้า
    //   - เกิน 6 นาทียังไม่เสร็จ -> คืนผลเป็น error
    const waitForUpdateModel = async (jobId) => {
        const deadline = Date.now() + UPDATE_MODEL_MAX_WAIT_MS;

        while (Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, UPDATE_MODEL_POLL_MS));
            try {
                const res = await fetchWithTimeout(`${UPDATE_MODEL_URL}/${jobId}`);
                const json = await res.json();
                if (json.status !== 'running') return json;
            } catch (err) {
                console.log('ถามผลอัปเดตโมเดลไม่สำเร็จ จะลองใหม่:', err);
            }
        }

        return { status: 'error', error: 'รอนานเกินไป กลับเข้าหน้านี้ใหม่เพื่อดูเพลงที่เหลือ' };
    };

    // ส่งเพลงที่เลือกไปฝึกเข้าโมเดล
    //   1) ส่ง newsong_ids ไปที่ Render (รอได้ 2 นาที เผื่อ server กำลังตื่นจากการพัก)
    //   2) ถ้า server ตอบว่าเริ่มงานแล้ว ('started') ให้รอผลด้วย waitForUpdateModel
    //      ถ้าตอบผลมาเลย (เช่น error ทันที) ก็ใช้ผลนั้น
    //   3) ถ้าสำเร็จ: แจ้งจำนวนเพลงที่ฝึก, เอาเพลงที่เลือกออกจากรายการบนจอ, ล้างการติ๊ก
    //      ถ้าไม่สำเร็จ: แจ้งข้อความ error จาก server
    //   4) ไม่ว่าผลเป็นอะไร ให้ปุ่มกลับมากดได้ (finally)
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
                120000
            );
            const started = await res.json();
            const json = started.status === 'started'
                ? await waitForUpdateModel(started.job_id)
                : started;

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

                <Text style={styles.screenTitle}>Update Model</Text>

                <View style={styles.cardContainer}>
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
                                        <View style={styles.imagePlaceholder} />

                                        <Text style={styles.songTitle} numberOfLines={2}>
                                            {item.newsong_artist} - {item.newsong_name}
                                        </Text>

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

                    <View style={styles.buttonContainer}>
                        {submitting && (
                            <Text style={styles.submittingText}>
                                กำลังเพิ่มเพลงเข้าโมเดล อาจใช้เวลา 1–2 นาที
                            </Text>
                        )}
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
    submittingText: {
        fontSize: 14,
        color: '#556AB0',
        textAlign: 'center',
        marginBottom: 12,
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
