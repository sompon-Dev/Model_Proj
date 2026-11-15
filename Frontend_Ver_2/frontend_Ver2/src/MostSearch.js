import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';

// หน้าสถิติเพลงยอดนิยม (สำหรับแอดมิน) ทำได้ 3 อย่าง:
//   1) ดูยอดฟังของแต่ละเพลง แยกตามช่วงเวลา ทั้งหมด / สัปดาห์ / เดือน / ปี
//   2) ติ๊กเลือกเพลงแนะนำเอง (สูงสุด 2 เพลง) แล้วกด Add ไปแสดงในส่วน "For You" ของหน้าผู้ใช้
//   3) เปิด Auto Recomend ให้ระบบเลือกเพลงแนะนำจากสถิติให้อัตโนมัติ
// ยอดฟังมาจากตาราง trending_song ซึ่งจะ +1 ทุกครั้งที่ผู้ใช้กดเปิดเพลง

// API อ่านเพลงและยอดฟังทั้งหมด
const TRENDING_SONG_URL = 'https://lyriseek-api-database.onrender.com/trending_song';
// API ตั้งเพลงที่เลือกให้เป็นเพลงแนะนำ
const ADD_RECOMMEND_URL = 'https://lyriseek-api-database.onrender.com/trending_song/add_recommend';
// API อ่าน (GET) และเปิด/ปิด (PUT) โหมดแนะนำอัตโนมัติ
const AUTO_RECOMMEND_URL = 'https://lyriseek-api-database.onrender.com/trending_song/auto_recommend';

// เลือกเพลงแนะนำได้สูงสุดกี่เพลง
const MAX_SELECT = 2;

// แท็บช่วงเวลาของสถิติ
//   key    = ชื่อคอลัมน์ในตาราง trending_song ที่ใช้เรียงและแสดงยอด
//   label  = ข้อความบนแท็บ
//   suffix = คำต่อท้ายยอดฟังใต้ชื่อเพลง เช่น "ฟัง 12 ครั้ง (สัปดาห์นี้)"
// ยอดรายสัปดาห์/เดือน/ปี จะถูก server รีเซ็ตเป็น 0 เมื่อขึ้นรอบใหม่
const PERIODS = [
    { key: 'trend_alltime', label: 'ทั้งหมด', suffix: 'ทั้งหมด' },
    { key: 'trend_one_week', label: 'สัปดาห์', suffix: 'สัปดาห์นี้' },
    { key: 'trend_one_month', label: 'เดือน', suffix: 'เดือนนี้' },
    { key: 'trend_one_year', label: 'ปี', suffix: 'ปีนี้' },
];

const MostSearch = ({ navigation }) => {
    const [mostSearchedSongs, setMostSearchedSongs] = useState([]); // เพลงทั้งหมดในตาราง trending_song พร้อมยอดฟัง
    const [selectedIds, setSelectedIds] = useState([]);   // trend_song_id ของเพลงที่แอดมินติ๊กเลือกเอง
    const [loaded, setLoaded] = useState(false);          // true เมื่อโหลดเสร็จ (กันขึ้น "ไม่พบ" ก่อนโหลดเสร็จ)
    const [submitting, setSubmitting] = useState(false);  // true ระหว่างกด Add
    const [autoOn, setAutoOn] = useState(false);          // โหมดแนะนำอัตโนมัติเปิดอยู่ไหม (ค่าจริงเก็บใน database)
    const [autoIds, setAutoIds] = useState([]);           // เพลงที่ระบบเลือกให้ตอนโหมดอัตโนมัติเปิด (ไว้ไฮไลต์)
    const [savingAuto, setSavingAuto] = useState(false);  // true ระหว่างกำลังบันทึกการเปิด/ปิดโหมดอัตโนมัติ
    const [period, setPeriod] = useState(PERIODS[0]);     // แท็บช่วงเวลาที่เลือกอยู่ (เริ่มที่ "ทั้งหมด")

    // เรียงเพลงจากยอดฟังมากไปน้อย ตามช่วงเวลาของแท็บที่เลือก
    // [...list] = ก๊อปรายการออกมาก่อนค่อยเรียง เพื่อไม่ให้ข้อมูลต้นฉบับใน state ถูกแก้
    // (b - a) = เรียงจากมากไปน้อย, || 0 = ถ้าไม่มีค่าให้นับเป็น 0
    // คำนวณใหม่ทุกครั้งที่เปลี่ยนแท็บ โดยไม่ต้องโหลดข้อมูลจาก server ใหม่
    const sortedSongs = [...mostSearchedSongs].sort((a, b) => (b[period.key] || 0) - (a[period.key] || 0));

    // ตอนเปิดหน้า: โหลดข้อมูล 2 อย่างพร้อมกัน
    //   1) รายชื่อเพลงและยอดฟังทั้งหมด
    //   2) สถานะโหมดแนะนำอัตโนมัติ (เปิดหรือปิด และเพลงไหนที่ระบบเลือกไว้)
    useEffect(() => {
        fetch(TRENDING_SONG_URL)
            .then((res) => res.json())
            .then((json) => setMostSearchedSongs(json.data || []))
            .catch((err) => console.log('โหลด trending_song ไม่สำเร็จ:', err))
            .finally(() => setLoaded(true));
        fetch(AUTO_RECOMMEND_URL)
            .then((res) => res.json())
            .then((json) => {
                setAutoOn(!!json.enabled);
                setAutoIds(json.trend_song_ids || []);
            })
            .catch((err) => console.log('โหลดสถานะ Auto Recomend ไม่สำเร็จ:', err));
    }, []);

    // กดช่อง Auto Recomend: สลับเปิด/ปิดโหมดแนะนำอัตโนมัติ และบันทึกลง database ทันที
    // เมื่อเปิด server จะเลือกเพลงแนะนำให้เอง 2 เพลง:
    //   เพลงที่ 1 = ยอดฟังรายเดือนสูงสุด, เพลงที่ 2 = ยอดฟังรายสัปดาห์สูงสุด
    // ระหว่างที่โหมดนี้เปิด แอดมินจะติ๊กเลือกเพลงเองไม่ได้ ต้องปิดโหมดก่อน
    const toggleAuto = async () => {
        setSavingAuto(true);
        try {
            const res = await fetch(AUTO_RECOMMEND_URL, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !autoOn }),
            });
            const json = await res.json();
            if (json.status === 'success') {
                setAutoOn(json.enabled);
                setAutoIds(json.trend_song_ids || []);
            } else {
                Alert.alert('ไม่สำเร็จ', json.error || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ');
            }
        } catch (err) {
            console.log('ตั้งค่า Auto Recomend ไม่สำเร็จ:', err);
            Alert.alert('ไม่สำเร็จ', 'เชื่อมต่อ server ไม่ได้ ลองใหม่อีกครั้ง');
        } finally {
            setSavingAuto(false);
        }
    };

    // ติ๊ก/ยกเลิกติ๊กเพลง (เลือกพร้อมกันได้สูงสุด MAX_SELECT เพลง)
    //   - เพลงนี้ติ๊กอยู่แล้ว -> เอาติ๊กออก
    //   - ติ๊กครบจำนวนสูงสุดแล้ว -> เตือนว่าเลือกเพิ่มไม่ได้
    //   - นอกนั้น -> เพิ่มเพลงนี้เข้ารายการที่เลือก
    const toggleSelect = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter((item) => item !== id));
            return;
        }
        if (selectedIds.length >= MAX_SELECT) {
            Alert.alert('แจ้งเตือน', `เลือกเพลงแนะนำได้สูงสุด ${MAX_SELECT} เพลง`);
            return;
        }
        setSelectedIds([...selectedIds, id]);
    };

    // กดปุ่ม Add: ตั้งเพลงที่ติ๊กไว้ให้เป็นเพลงแนะนำ
    // server จะล้างเพลงแนะนำเก่าทั้งหมดก่อน แล้วตั้ง trend_add = true ให้เพลงที่ส่งไป
    // เพลงเหล่านี้จะไปแสดงในส่วน "For You" ของหน้า Homeuser
    // สำเร็จแล้วพากลับไปหน้าเมนูแอดมิน
    const handleAddPress = async () => {
        if (selectedIds.length === 0) {
            Alert.alert('แจ้งเตือน', 'กรุณาติ๊กเลือกเพลงก่อน');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(ADD_RECOMMEND_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trend_song_ids: selectedIds }),
            });
            const json = await res.json();

            if (json.status === 'success') {
                Alert.alert('สำเร็จ', 'ตั้งเป็นเพลงแนะนำเรียบร้อยแล้ว');
                navigation?.goBack();
            } else {
                Alert.alert('ไม่สำเร็จ', json.error || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ');
            }
        } catch (err) {
            console.log('ตั้งเพลงแนะนำไม่สำเร็จ:', err);
            Alert.alert('ไม่สำเร็จ', 'เชื่อมต่อ server ไม่ได้ ลองใหม่อีกครั้ง');
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

                <Text style={styles.screenTitle}>Most searched songs</Text>

                <View style={styles.tabRow}>
                    {PERIODS.map((p) => {
                        const active = p.key === period.key;
                        return (
                            <TouchableOpacity
                                key={p.key}
                                style={[styles.tab, active && styles.tabActive]}
                                activeOpacity={0.8}
                                onPress={() => setPeriod(p)}
                            >
                                <Text style={[styles.tabText, active && styles.tabTextActive]}>{p.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={styles.cardContainer}>
                    <TouchableOpacity
                        style={styles.autoRow}
                        activeOpacity={0.7}
                        onPress={toggleAuto}
                        disabled={savingAuto}
                    >
                        <Feather
                            name={autoOn ? 'check-square' : 'square'}
                            size={20}
                            color={autoOn ? '#556AB0' : '#9CA3AF'}
                        />
                        <Text style={styles.autoText}>{savingAuto ? '...' : 'Auto Recomend'}</Text>
                    </TouchableOpacity>

                    {loaded && mostSearchedSongs.length === 0 ? (
                        <Text style={styles.notFoundText}>ไม่พบเพลงใน trending</Text>
                    ) : (
                        <View style={styles.listContainer}>
                            {sortedSongs.map((item) => {
                                const isSelected = autoOn
                                    ? autoIds.includes(item.trend_song_id)
                                    : selectedIds.includes(item.trend_song_id);
                                return (
                                    <TouchableOpacity
                                        key={item.trend_song_id}
                                        style={[styles.songItem, autoOn && !isSelected && styles.songItemDisabled]}
                                        activeOpacity={0.8}
                                        onPress={() => toggleSelect(item.trend_song_id)}
                                        disabled={autoOn}
                                    >
                                        {item.Image_Link ? (
                                            <Image source={{ uri: item.Image_Link }} style={styles.imagePlaceholder} />
                                        ) : (
                                            <View style={styles.imagePlaceholder} />
                                        )}
                                        <View style={styles.songInfo}>
                                            <Text style={styles.songTitle} numberOfLines={2}>
                                                {item.trend_song_name}
                                            </Text>
                                            <Text style={styles.songCount}>
                                                ฟัง {(item[period.key] || 0).toLocaleString()} ครั้ง ({period.suffix})
                                            </Text>
                                        </View>
                                        <Feather
                                            name={isSelected ? 'check-square' : 'square'}
                                            size={22}
                                            color={isSelected ? '#556AB0' : '#9CA3AF'}
                                        />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    <View style={styles.bottomRow}>
                        <Text style={styles.recommendLabel}>add to recommend</Text>
                        <TouchableOpacity
                            style={[styles.addButton, autoOn && styles.addButtonDisabled]}
                            activeOpacity={0.85}
                            onPress={handleAddPress}
                            disabled={submitting || autoOn}
                        >
                            <Text style={styles.addButtonText}>
                                {submitting ? '...' : 'Add'}
                            </Text>
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
        fontSize: 30,
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
        paddingBottom: 28,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
        minHeight: 460,
        justifyContent: 'space-between',
    },
    autoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-end',
        marginTop: -12,
        marginBottom: 16,
    },
    autoText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#556AB0',
        marginLeft: 6,
    },
    songItemDisabled: {
        opacity: 0.4,
    },
    addButtonDisabled: {
        opacity: 0.4,
    },
    listContainer: {
        width: '100%',
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
    tabRow: {
        flexDirection: 'row',
        backgroundColor: '#EEF0FB',
        borderRadius: 14,
        padding: 4,
        marginBottom: 20,
    },
    tab: {
        flex: 1,
        height: 38,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabActive: {
        backgroundColor: '#98A6FE',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    tabTextActive: {
        color: '#FFFFFF',
    },
    songInfo: {
        flex: 1,
        marginRight: 8,
    },
    songCount: {
        fontSize: 13,
        color: '#556AB0',
        marginTop: 2,
    },
    songTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#111827',
        lineHeight: 22,
    },
    notFoundText: {
        fontSize: 15,
        color: '#888888',
        textAlign: 'center',
        marginTop: 40,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 20,
        paddingTop: 10,
    },
    recommendLabel: {
        fontSize: 15,
        color: '#6B7280',
        fontWeight: '500',
    },
    addButton: {
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
    addButtonText: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#556AB0',
    },
});

export default MostSearch;
