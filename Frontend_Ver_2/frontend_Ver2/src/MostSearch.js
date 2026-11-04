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

const TRENDING_SONG_URL = 'https://lyriseek-api-database.onrender.com/trending_song'; // ⚠️ เปลี่ยน IP เป็นของเครื่อง Server (Backend_Database/main.py) ถ้าเปลี่ยนเครื่อง
const ADD_RECOMMEND_URL = 'https://lyriseek-api-database.onrender.com/trending_song/add_recommend'; // ⚠️ IP เดียวกับ TRENDING_SONG_URL
const AUTO_RECOMMEND_URL = 'https://lyriseek-api-database.onrender.com/trending_song/auto_recommend'; // ⚠️ IP เดียวกับ TRENDING_SONG_URL

const MAX_SELECT = 2; // ติ๊กเลือกเพลงแนะนำได้สูงสุดกี่เพลง

const MostSearch = ({ navigation }) => {
    const [mostSearchedSongs, setMostSearchedSongs] = useState([]); // [{ trend_song_id, song_id, trend_song_name, ... }, ...]
    const [selectedIds, setSelectedIds] = useState([]);
    const [loaded, setLoaded] = useState(false); // true หลังโหลดเสร็จครั้งแรก (กันขึ้น "ไม่พบ" ก่อนโหลดเสร็จ)
    const [submitting, setSubmitting] = useState(false);
    const [autoOn, setAutoOn] = useState(false); // ช่อง "Auto Recomend" ติ๊กอยู่ไหม (ค่าจริงเก็บใน DB ตาราง trend_setting)
    const [autoIds, setAutoIds] = useState([]); // trend_song_id ที่ระบบเลือกให้อัตโนมัติ (ไว้ไฮไลต์ในลิสต์)
    const [savingAuto, setSavingAuto] = useState(false);

    // โหลดรายชื่อเพลงทั้งหมดในตาราง trending_song + สถานะ Auto Recomend ตอนเปิดหน้านี้
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

    // กดช่อง "Auto Recomend": บันทึกลง DB ทันที ติ๊กอยู่ = For You เลือกเพลงจากสถิติเอง
    // (เพลงที่ 1 จาก trend_one_month สูงสุด เพลงที่ 2 จาก trend_one_week สูงสุด ดู pick_auto_recommend ใน main.py)
    // ระหว่างติ๊กอยู่จะเลือกเพลงเองไม่ได้ ต้องเอาติ๊กออกก่อนถึงกลับมาเลือกแบบ manual ได้
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

    // ติ๊ก/ถอนติ๊ก (เหมือน checkbox) — ติ๊กพร้อมกันได้สูงสุด MAX_SELECT เพลง
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

    // กดปุ่ม Add: ตั้งเพลงที่ติ๊กไว้ให้เป็นเพลงแนะนำ (trend_add = true) ไปโชว์ใน "For You" ของ Homeuser.js
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
                        onPress={() => navigation?.navigate('AdminProfile')}
                    >
                        <Feather name="user" size={24} color="#1E1E1E" />
                    </TouchableOpacity>
                </View>

                {/* Title */}
                <Text style={styles.screenTitle}>Most searched songs</Text>

                {/* White Container */}
                <View style={styles.cardContainer}>
                    {/* ช่องติ๊ก Auto Recomend มุมขวาบน */}
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

                    {/* Song List: ดึงมาจากตาราง trending_song จริง ถ้าไม่มีเพลงเลยให้ขึ้น "ไม่พบ" */}
                    {loaded && mostSearchedSongs.length === 0 ? (
                        <Text style={styles.notFoundText}>ไม่พบเพลงใน trending</Text>
                    ) : (
                        <View style={styles.listContainer}>
                            {mostSearchedSongs.map((item) => {
                                // ติ๊ก Auto อยู่: โชว์เพลงที่ระบบเลือกให้ และกดเลือกเองไม่ได้
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
                                        <Text style={styles.songTitle} numberOfLines={2}>
                                            {item.trend_song_name}
                                        </Text>
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

                    {/* Bottom Action Row */}
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
    songTitle: {
        flex: 1,
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
