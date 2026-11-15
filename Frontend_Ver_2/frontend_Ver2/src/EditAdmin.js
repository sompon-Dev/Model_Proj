import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Image,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    Modal,
    ScrollView,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';

// หน้าแก้ไขข้อมูลเพลง (สำหรับแอดมิน)
// วิธีใช้: พิมพ์ชื่อเพลงเพื่อค้นหา -> กดเพลงที่ต้องการ -> แก้ข้อมูลในหน้าต่างที่เด้งขึ้นมา -> บันทึก
// แก้ได้ 4 อย่าง: ชื่อศิลปิน, ลิงก์ YouTube, แนวเพลง (genre), อารมณ์เพลง (mood)
// (ชื่อเพลงและเนื้อเพลงแก้ในหน้านี้ไม่ได้)

// ที่อยู่หลักของ API บน Render
const API_URL = 'https://lyriseek-api-database.onrender.com';
// หลังหยุดพิมพ์ 0.3 วินาทีจึงค่อยค้นหา (ไม่ค้นทุกตัวอักษรที่พิมพ์ ประหยัดการเรียก server)
const SEARCH_DELAY_MS = 300;
// แสดงคำแนะนำ genre/mood ได้สูงสุด 30 รายการ (กันรายการยาวเกินจอ)
const MAX_SUGGESTIONS = 30;

// รูปแบบลิงก์ YouTube ที่ยอมรับ ใช้ดึง "รหัสวิดีโอ" 11 ตัวอักษรออกมา
// รับได้ทั้งแบบ youtube.com/watch?v=XXXXXXXXXXX, music.youtube.com/... และ youtu.be/XXXXXXXXXXX
// ไม่รับลิงก์ที่ไม่มีรหัสวิดีโอ เช่น ลิงก์ playlist หรือลิงก์ช่อง
const YOUTUBE_LINK_RE = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:youtube\.com\/\S*[?&]v=|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/i;
// คืนรหัสวิดีโอจากลิงก์ ถ้าลิงก์ไม่ถูกรูปแบบจะคืนค่าว่าง ''
const getVideoId = (link) => link.trim().match(YOUTUBE_LINK_RE)?.[1] ?? '';

// fetch แบบมีเวลาหมดอายุ (ค่าเริ่มต้น 30 วินาที เผื่อ server บน Render ที่กำลังตื่นจากการพัก)
// ถ้า server ไม่ตอบภายในเวลาที่กำหนด จะยกเลิกคำขอให้เอง หน้าจอจะได้ไม่ค้าง
const fetchWithTimeout = async (url, options = {}, timeoutMs = 30000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
};

// ส่วนเลือกหมวดหมู่ที่ใช้ซ้ำได้ ใช้ทั้งกับ genre และ mood
// รับค่าเข้ามา:
//   label    = ชื่อที่แสดง เช่น 'Genre'
//   options  = หมวดทั้งหมดที่มีในระบบ
//   selected = หมวดที่เพลงนี้มีอยู่ตอนนี้
//   onToggle = ฟังก์ชันที่เรียกเมื่อกดติ๊ก/ยกเลิก
//   idKey, nameKey = ชื่อช่อง id และชื่อ เช่น 'genre_id' กับ 'genre_name'
// การแสดงผล: หมวดที่เลือกแล้วแสดงไว้ด้านบนเสมอ ส่วนหมวดอื่นจะโผล่เป็นคำแนะนำเมื่อพิมพ์ค้นหา
const CategoryPicker = ({ label, options, selected, onToggle, idKey, nameKey }) => {
    const [text, setText] = useState(''); // คำที่พิมพ์ในช่องค้นหาหมวด

    // หาคำแนะนำ: หมวดที่ยังไม่ได้เลือก และชื่อมีคำที่พิมพ์อยู่ (ไม่สนตัวพิมพ์เล็ก-ใหญ่)
    // ตัดให้เหลือไม่เกิน MAX_SUGGESTIONS รายการ ถ้ายังไม่ได้พิมพ์อะไรจะไม่แสดงคำแนะนำ
    const selectedIds = selected.map((item) => item[idKey]);
    const keyword = text.trim().toLowerCase();
    const suggestions = keyword
        ? options
              .filter(
                  (item) =>
                      !selectedIds.includes(item[idKey]) &&
                      item[nameKey].toLowerCase().includes(keyword)
              )
              .slice(0, MAX_SUGGESTIONS)
        : [];

    const renderRow = (item, isChecked) => (
        <TouchableOpacity
            key={item[idKey]}
            style={styles.checkRow}
            activeOpacity={0.7}
            onPress={() => onToggle(item)}
        >
            <Feather
                name={isChecked ? 'check-square' : 'square'}
                size={20}
                color={isChecked ? '#4A60A4' : '#9CA3AF'}
            />
            <Text style={styles.checkText}>{item[nameKey]}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <View style={styles.inputBox}>
                <TextInput
                    style={styles.input}
                    placeholder={`พิมพ์เพื่อค้นหา ${label}`}
                    placeholderTextColor="#6B7280"
                    value={text}
                    onChangeText={setText}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            {selected.map((item) => renderRow(item, true))}
            {suggestions.map((item) => renderRow(item, false))}
            {keyword && suggestions.length === 0 ? (
                <Text style={styles.hintText}>ไม่พบ {label} ที่ตรงกับคำนี้</Text>
            ) : null}
        </View>
    );
};

const EditAdmin = ({ navigation }) => {
    // ===== ส่วนค้นหาเพลง =====
    const [query, setQuery] = useState('');                 // คำที่พิมพ์ในช่องค้นหา
    const [songs, setSongs] = useState([]);                 // เพลงที่ค้นเจอ
    const [searching, setSearching] = useState(false);      // true ระหว่างรอผลค้นหา
    const [searchFailed, setSearchFailed] = useState(false); // true ถ้าค้นหาแล้วเชื่อมต่อ server ไม่ได้
    // ลำดับของการค้นหาล่าสุด ใช้กันผลเก่ามาทับผลใหม่ (อธิบายใน useEffect ด้านล่าง)
    // useRef = ตัวแปรที่จำค่าได้ข้ามการวาดหน้าจอใหม่ และเปลี่ยนค่าได้โดยไม่ทำให้หน้าจอวาดใหม่
    const latestSearch = useRef(0);

    // genre และ mood ทั้งหมดในระบบ (ใช้เป็นตัวเลือกตอนแก้ไข)
    const [genreOptions, setGenreOptions] = useState([]);
    const [moodOptions, setMoodOptions] = useState([]);

    // ===== ส่วนแก้ไขเพลง =====
    const [editingSong, setEditingSong] = useState(null);    // เพลงที่กำลังแก้ (null = หน้าต่างแก้ไขปิดอยู่)
    const [artist, setArtist] = useState('');                // ค่าศิลปินในฟอร์ม
    const [youtubeLink, setYoutubeLink] = useState('');      // ค่าลิงก์ YouTube ในฟอร์ม
    const [selectedGenres, setSelectedGenres] = useState([]); // genre ที่ติ๊กไว้ (เก็บทั้ง object มี id และชื่อ)
    const [selectedMoods, setSelectedMoods] = useState([]);   // mood ที่ติ๊กไว้
    const [saving, setSaving] = useState(false);             // true ระหว่างบันทึก

    // ตอนเปิดหน้า: โหลด genre และ mood ทั้งหมดมาเก็บไว้ใช้เป็นตัวเลือก
    useEffect(() => {
        fetchWithTimeout(`${API_URL}/Genre`)
            .then((res) => res.json())
            .then((json) => setGenreOptions(json.data || []))
            .catch((err) => console.log('โหลด genre ไม่สำเร็จ:', err));
        fetchWithTimeout(`${API_URL}/Mood`)
            .then((res) => res.json())
            .then((json) => setMoodOptions(json.data || []))
            .catch((err) => console.log('โหลด mood ไม่สำเร็จ:', err));
    }, []);

    // ค้นหาเพลงอัตโนมัติทุกครั้งที่คำค้นเปลี่ยน
    // ค้นจาก "ชื่อเพลง" ในฐานข้อมูล ที่มีคำนี้อยู่ส่วนไหนก็ได้ (ไม่ใช่ค้นจากเนื้อร้อง) ได้ผลไม่เกิน 50 เพลง
    // มีเทคนิค 2 อย่าง:
    //   1) หน่วงเวลา (debounce): ตั้งเวลา 0.3 วินาทีก่อนค่อยค้น
    //      ถ้าพิมพ์ตัวถัดไปก่อนครบเวลา คำสั่ง return ด้านล่างจะยกเลิกนาฬิกาเดิม แล้วเริ่มนับใหม่
    //      ผลคือค้นแค่ครั้งเดียวตอนพิมพ์เสร็จ ไม่ใช่ค้นทุกตัวอักษร
    //   2) กันผลเก่ามาทับผลใหม่: การค้นแต่ละครั้งได้หมายเลข (searchId)
    //      ตอนผลกลับมา จะเอาผลไปแสดงก็ต่อเมื่อเป็นการค้นครั้งล่าสุดเท่านั้น
    //      (กันกรณีค้น "ab" แล้ว "abc" แต่ผลของ "ab" ช้ากว่า แล้วมาทับผลของ "abc")
    // ถ้าช่องค้นหาว่าง ให้ล้างผลทิ้งแล้วไม่ต้องค้น
    useEffect(() => {
        const keyword = query.trim();
        const searchId = ++latestSearch.current;

        if (!keyword) {
            setSongs([]);
            setSearching(false);
            setSearchFailed(false);
            return undefined;
        }

        setSearching(true);
        const timer = setTimeout(async () => {
            try {
                const res = await fetchWithTimeout(
                    `${API_URL}/Song/search?q=${encodeURIComponent(keyword)}`
                );
                const json = await res.json();
                if (searchId === latestSearch.current) {
                    setSongs(json.data || []);
                    setSearchFailed(false);
                }
            } catch (err) {
                console.log('ค้นหาเพลงไม่สำเร็จ:', err);
                if (searchId === latestSearch.current) {
                    setSongs([]);
                    setSearchFailed(true);
                }
            } finally {
                if (searchId === latestSearch.current) setSearching(false);
            }
        }, SEARCH_DELAY_MS);

        return () => clearTimeout(timer);
    }, [query]);

    // กดเพลงในผลค้นหา: เปิดหน้าต่างแก้ไข แล้วเติมค่าปัจจุบันของเพลงลงในฟอร์ม
    // genres/moods ของเพลงมาจาก server พร้อมผลค้นหาแล้ว จึงใส่ได้ทันที
    const openEditor = (song) => {
        setEditingSong(song);
        setArtist(song.Artist || '');
        setYoutubeLink(song.youtube_link || '');
        setSelectedGenres(song.genres);
        setSelectedMoods(song.moods);
    };

    // สร้างฟังก์ชันติ๊ก/ยกเลิกติ๊ก ใช้ได้ทั้ง genre และ mood
    // เช่น toggleIn(setSelectedGenres, 'genre_id') จะได้ฟังก์ชันที่รับ genre 1 ตัว แล้ว:
    //   - ถ้ามี id นี้อยู่ในรายการแล้ว -> เอาออก
    //   - ถ้ายังไม่มี -> เพิ่มเข้าไป
    const toggleIn = (setList, idKey) => (item) => {
        setList((prev) =>
            prev.some((x) => x[idKey] === item[idKey])
                ? prev.filter((x) => x[idKey] !== item[idKey])
                : [...prev, item]
        );
    };

    // ตรวจลิงก์ YouTube และเตรียมรูปตัวอย่างระหว่างแก้ไข (คำนวณใหม่ทุกครั้งที่พิมพ์)
    //   linkChanged  = ลิงก์ในฟอร์มต่างจากลิงก์เดิมของเพลงไหม
    //   linkInvalid  = เปลี่ยนลิงก์แล้ว แต่ลิงก์ใหม่ไม่มีรหัสวิดีโอ (ใช้ไม่ได้)
    //   previewImage = รูปปกที่จะแสดง
    //       ลิงก์ไม่เปลี่ยน     -> ใช้รูปเดิม
    //       ลิงก์ใหม่ถูกต้อง   -> สร้างลิงก์รูปปกจากรหัสวิดีโอ (รูปแบบเดียวกับที่ server สร้าง)
    //       ลิงก์ใหม่ไม่ถูกต้อง -> ไม่แสดงรูป
    const linkChanged = editingSong !== null && youtubeLink.trim() !== (editingSong.youtube_link || '');
    const linkInvalid = linkChanged && !getVideoId(youtubeLink);
    let previewImage = editingSong?.Image_Link;
    if (linkChanged) {
        previewImage = linkInvalid
            ? null
            : `https://img.youtube.com/vi/${getVideoId(youtubeLink)}/hqdefault.jpg`;
    }

    // กดบันทึกการแก้ไข
    //   1) ถ้าลิงก์ใหม่ไม่ถูกต้อง ให้เตือนแล้วหยุด
    //   2) ส่งค่าใหม่ทั้งหมดไปที่ server (PUT /Song/<song_id>/details)
    //      genre/mood ส่งเป็นรายการ id ทั้งชุด server จะลบของเดิมทิ้งแล้วใส่ชุดนี้แทน
    //      server ยังแก้ศิลปิน/ลิงก์/รูปปก ในตาราง history ให้ตรงกันด้วย
    //   3) ถ้าสำเร็จ: อัปเดตเพลงนั้นในผลค้นหาบนจอทันที (ไม่ต้องค้นใหม่) แล้วปิดหน้าต่างแก้ไข
    //      ลิงก์และรูปปกใช้ค่าที่ server ส่งกลับมา เพราะ server เป็นคนสร้างลิงก์รูปปกใหม่
    //      ถ้าลบชื่อศิลปินจนว่าง จะเก็บเป็น null (ไม่มีศิลปิน)
    const handleSave = async () => {
        if (linkInvalid) {
            Alert.alert('ลิงก์ไม่ถูกต้อง', 'ต้องเป็นลิงก์เพลงเดี่ยวของ YouTube หรือ YouTube Music');
            return;
        }

        setSaving(true);
        try {
            const res = await fetchWithTimeout(`${API_URL}/Song/${editingSong.song_id}/details`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    artist: artist.trim(),
                    youtube_link: youtubeLink.trim(),
                    genre_ids: selectedGenres.map((g) => g.genre_id),
                    mood_ids: selectedMoods.map((m) => m.mood_id),
                }),
            });
            const json = await res.json();

            if (json.status === 'success') {
                const updated = {
                    ...editingSong,
                    Artist: artist.trim() || null,
                    youtube_link: json.youtube_link,
                    Image_Link: json.Image_Link,
                    genres: selectedGenres,
                    moods: selectedMoods,
                };
                setSongs((prev) =>
                    prev.map((s) => (s.song_id === updated.song_id ? updated : s))
                );
                setEditingSong(null);
                Alert.alert('สำเร็จ', 'บันทึกการแก้ไขเรียบร้อยแล้ว');
            } else {
                Alert.alert('บันทึกไม่สำเร็จ', json.error || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ');
            }
        } catch (err) {
            console.log('บันทึกไม่สำเร็จ:', err);
            Alert.alert('บันทึกไม่สำเร็จ', 'เชื่อมต่อ server ไม่ได้ ลองใหม่อีกครั้ง');
        } finally {
            setSaving(false);
        }
    };

    const renderSongCard = ({ item }) => (
        <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => openEditor(item)}>
            {item.Image_Link ? (
                <Image source={{ uri: item.Image_Link }} style={styles.songImage} />
            ) : (
                <View style={styles.songImage} />
            )}

            <View style={styles.songInfo}>
                <Text style={styles.songTitle} numberOfLines={2}>
                    {item.song_name}
                </Text>
                {item.Artist ? (
                    <Text style={styles.songArtist} numberOfLines={1}>
                        {item.Artist}
                    </Text>
                ) : null}
                {item.genres.length > 0 ? (
                    <Text style={styles.songMeta} numberOfLines={2}>
                        Genre: {item.genres.map((g) => g.genre_name).join(', ')}
                    </Text>
                ) : null}
                {item.moods.length > 0 ? (
                    <Text style={styles.songMeta} numberOfLines={2}>
                        Mood: {item.moods.map((m) => m.mood_name).join(', ')}
                    </Text>
                ) : null}
            </View>

            <Feather name="edit-2" size={18} color="#556AB0" />
        </TouchableOpacity>
    );

    let emptyText = 'พิมพ์ชื่อเพลงเพื่อค้นหา';
    if (searchFailed) emptyText = 'ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง';
    else if (query.trim()) emptyText = 'ไม่พบเพลงที่ตรงกับคำนี้';

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />

            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.circleButton}
                    activeOpacity={0.7}
                    onPress={() => navigation?.goBack()}
                >
                    <Feather name="arrow-left" size={24} color="#1E1E1E" />
                </TouchableOpacity>

                <Text style={styles.screenTitle}>Edit Song</Text>

                <TouchableOpacity
                    style={styles.circleButton}
                    activeOpacity={0.7}
                    onPress={() => navigation?.navigate('AdminProfile')}
                >
                    <Feather name="user" size={24} color="#1E1E1E" />
                </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
                <Feather name="search" size={22} color="#1E1E1E" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="ค้นหาจากชื่อเพลง"
                    placeholderTextColor="#999999"
                    value={query}
                    onChangeText={setQuery}
                    returnKeyType="search"
                    autoCorrect={false}
                />
                {searching ? <ActivityIndicator size="small" color="#556AB0" /> : null}
            </View>

            <FlatList
                data={songs}
                keyExtractor={(item) => String(item.song_id)}
                renderItem={renderSongCard}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    searching ? null : <Text style={styles.emptyText}>{emptyText}</Text>
                }
            />

            <Modal
                visible={editingSong !== null}
                animationType="slide"
                onRequestClose={() => setEditingSong(null)}
            >
                {editingSong ? (
                    <SafeAreaView style={styles.container}>
                        <KeyboardAvoidingView
                            style={styles.modalBody}
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        >
                            <View style={styles.header}>
                                <TouchableOpacity
                                    style={styles.circleButton}
                                    activeOpacity={0.7}
                                    onPress={() => setEditingSong(null)}
                                    disabled={saving}
                                >
                                    <Feather name="x" size={24} color="#1E1E1E" />
                                </TouchableOpacity>
                                <Text style={styles.screenTitle}>แก้ไขเพลง</Text>
                                <View style={styles.headerSpacer} />
                            </View>

                            <ScrollView
                                contentContainerStyle={styles.formContent}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={styles.fieldGroup}>
                                    <Text style={styles.fieldLabel}>ชื่อเพลง</Text>
                                    <View style={[styles.inputBox, styles.inputBoxDisabled]}>
                                        <TextInput
                                            style={[styles.input, styles.inputDisabled]}
                                            value={editingSong.song_name}
                                            editable={false}
                                        />
                                    </View>
                                </View>

                                <View style={styles.fieldGroup}>
                                    <Text style={styles.fieldLabel}>ศิลปิน</Text>
                                    <View style={styles.inputBox}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="ชื่อศิลปิน"
                                            placeholderTextColor="#6B7280"
                                            value={artist}
                                            onChangeText={setArtist}
                                        />
                                    </View>
                                </View>

                                <View style={styles.fieldGroup}>
                                    <Text style={styles.fieldLabel}>ลิงก์ YouTube Music</Text>
                                    <View style={styles.inputBox}>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="https://music.youtube.com/watch?v=..."
                                            placeholderTextColor="#6B7280"
                                            value={youtubeLink}
                                            onChangeText={setYoutubeLink}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            keyboardType="url"
                                        />
                                    </View>
                                    {linkInvalid ? (
                                        <Text style={styles.errorText}>
                                            ลิงก์ไม่ถูกต้อง ต้องเป็นลิงก์เพลงเดี่ยวของ YouTube หรือ YouTube Music
                                        </Text>
                                    ) : null}
                                    {previewImage ? (
                                        <Image source={{ uri: previewImage }} style={styles.coverPreview} />
                                    ) : (
                                        <View style={styles.coverPreview} />
                                    )}
                                </View>

                                <CategoryPicker
                                    label="Genre"
                                    options={genreOptions}
                                    selected={selectedGenres}
                                    onToggle={toggleIn(setSelectedGenres, 'genre_id')}
                                    idKey="genre_id"
                                    nameKey="genre_name"
                                />

                                <CategoryPicker
                                    label="Mood"
                                    options={moodOptions}
                                    selected={selectedMoods}
                                    onToggle={toggleIn(setSelectedMoods, 'mood_id')}
                                    idKey="mood_id"
                                    nameKey="mood_name"
                                />

                                <View style={styles.buttonContainer}>
                                    <TouchableOpacity
                                        style={styles.saveButton}
                                        activeOpacity={0.85}
                                        onPress={handleSave}
                                        disabled={saving}
                                    >
                                        {saving ? (
                                            <ActivityIndicator color="#FFFFFF" />
                                        ) : (
                                            <Text style={styles.saveButtonText}>Save</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </KeyboardAvoidingView>
                    </SafeAreaView>
                ) : null}
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FD',
    },
    modalBody: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        marginBottom: 20,
    },
    headerSpacer: {
        width: 48,
    },
    screenTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
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
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 30,
        height: 56,
        paddingHorizontal: 18,
        marginHorizontal: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E8ECF2',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
        elevation: 3,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#1E1E1E',
        fontWeight: '500',
        height: '100%',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        flexGrow: 1,
    },
    emptyText: {
        fontSize: 15,
        color: '#888888',
        textAlign: 'center',
        marginTop: 60,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E8ECF2',
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    songImage: {
        width: 72,
        height: 54,
        borderRadius: 8,
        backgroundColor: '#E2E8F0',
        marginRight: 12,
    },
    songInfo: {
        flex: 1,
        marginRight: 10,
    },
    songTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#111827',
        lineHeight: 18,
    },
    songArtist: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6B7280',
        marginTop: 2,
    },
    songMeta: {
        fontSize: 12,
        color: '#556AB0',
        marginTop: 3,
    },
    formContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    fieldGroup: {
        marginBottom: 20,
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    inputBox: {
        backgroundColor: '#D1DCFE',
        borderRadius: 14,
        paddingHorizontal: 18,
        height: 52,
        justifyContent: 'center',
    },
    inputBoxDisabled: {
        backgroundColor: '#E5E7EB',
    },
    input: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E1E1E',
    },
    inputDisabled: {
        color: '#6B7280',
    },
    checkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 4,
    },
    checkText: {
        flex: 1,
        fontSize: 15,
        color: '#1E1E1E',
        marginLeft: 12,
    },
    hintText: {
        fontSize: 13,
        color: '#888888',
        marginTop: 10,
        marginLeft: 4,
    },
    errorText: {
        fontSize: 13,
        color: '#DC2626',
        marginTop: 8,
        marginLeft: 4,
    },
    coverPreview: {
        width: 160,
        height: 120,
        borderRadius: 10,
        backgroundColor: '#E2E8F0',
        marginTop: 12,
        alignSelf: 'center',
    },
    buttonContainer: {
        alignItems: 'center',
        marginTop: 8,
    },
    saveButton: {
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
    saveButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default EditAdmin;
