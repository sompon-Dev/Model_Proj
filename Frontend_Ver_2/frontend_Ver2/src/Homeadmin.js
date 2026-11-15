import React from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

// หน้าแรกของผู้ดูแลระบบ (แอดมิน) จะมาถึงหน้านี้เมื่อ Login แล้วตาราง users บอกว่า role = 'admin'
// หน้านี้ไม่มีการโหลดข้อมูลเอง ทำหน้าที่เป็น "เมนู" พาไปหน้าจัดการต่างๆ เมื่อกดการ์ด:
//   - ไอคอนคนมุมขวาบน  -> AdminProfile  ดูโปรไฟล์แอดมินและออกจากระบบ
//   - Add Songs        -> AddSong       เพิ่มเพลงใหม่ลงฐานข้อมูล
//   - Update Model     -> UpdateModel   เอาเพลงใหม่ไปฝึกเข้าโมเดลค้นหา
//   - Add Category     -> AddCategory   เพิ่มแนวเพลง (genre) และอารมณ์เพลง (mood)
//   - Most Search      -> MostSearch    ดูสถิติเพลงยอดนิยมและตั้งเพลงแนะนำ
//   - Edit Song        -> EditAdmin     แก้ไขข้อมูลเพลง (ศิลปิน ลิงก์ YouTube แนวเพลง อารมณ์เพลง)
//   - Search User      -> SearchUser    ดูรายชื่อผู้ใช้ทั้งหมด ระงับ/ปลดระงับ (ban) และลบบัญชี
// หมายเหตุ: ช่องค้นหาในหน้านี้ เมื่อกด Enter จะเปิดหน้า Result เปล่าๆ (ไม่ได้ส่งคำค้นไปค้นจริง)
const Homeadmin = ({ navigation }) => {
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.profileButton}
                        activeOpacity={0.7}
                        onPress={() => navigation?.navigate('AdminProfile')}
                    >
                        <Feather name="user" size={24} color="#1E1E1E" />
                    </TouchableOpacity>
                </View>

                <View style={styles.titleContainer}>
                    <Text style={styles.appTitle}>
                        Lyri<Text style={styles.appTitleHighlight}>Seek</Text>
                    </Text>
                </View>

                <View style={styles.searchContainer}>
                    <View style={styles.searchBar}>
                        <Feather
                            name="search"
                            size={22}
                            color="#1E1E1E"
                            style={styles.searchIcon}
                        />
                        <TextInput
                            style={styles.searchInput}
                            placeholder=""
                            placeholderTextColor="#999999"
                            returnKeyType="search"
                            onSubmitEditing={() => navigation?.navigate('Result')}
                        />
                    </View>
                </View>

                <View style={styles.gridContainer}>
                    <View style={styles.gridRow}>
                        <TouchableOpacity
                            style={[styles.card, styles.addSongCard]}
                            activeOpacity={0.8}
                            onPress={() => {
                                navigation?.navigate('AddSong');
                            }}
                        >
                            <View style={[styles.iconCircle, styles.addSongIconCircle]}>
                                <Feather name="music" size={26} color="#FFFFFF" />
                            </View>
                            <View style={styles.cardFooter}>
                                <Text style={styles.cardTitle}>Add Songs</Text>
                                <Feather name="chevron-right" size={24} color="#1E1E1E" />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.card, styles.updateModelCard]}
                            activeOpacity={0.8}
                            onPress={() => {
                                navigation?.navigate('UpdateModel');
                            }}
                        >
                            <View style={[styles.iconCircle, styles.updateModelIconCircle]}>
                                <MaterialCommunityIcons
                                    name="tray-arrow-down"
                                    size={28}
                                    color="#FFFFFF"
                                />
                            </View>
                            <View style={styles.cardFooter}>
                                <Text style={styles.cardTitle}>Update Model</Text>
                                <Feather name="chevron-right" size={24} color="#1E1E1E" />
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.gridRow}>
                        <TouchableOpacity
                            style={[styles.card, styles.addCategoryCard]}
                            activeOpacity={0.8}
                            onPress={() => {
                                navigation?.navigate('AddCategory');
                            }}
                        >
                            <View style={[styles.iconCircle, styles.addCategoryIconCircle]}>
                                <MaterialCommunityIcons
                                    name="file-document-plus-outline"
                                    size={28}
                                    color="#FFFFFF"
                                />
                            </View>
                            <View style={styles.cardFooter}>
                                <Text style={styles.cardTitle}>Add Category</Text>
                                <Feather name="chevron-right" size={24} color="#1E1E1E" />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.card, styles.mostSearchCard]}
                            activeOpacity={0.8}
                            onPress={() => {
                                navigation?.navigate('MostSearch');
                            }}
                        >
                            <View style={[styles.iconCircle, styles.mostSearchIconCircle]}>
                                <Ionicons name="search-outline" size={26} color="#FFFFFF" />
                            </View>
                            <View style={styles.cardFooter}>
                                <Text style={styles.cardTitle}>Most Search</Text>
                                <Feather name="chevron-right" size={24} color="#1E1E1E" />
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.gridRow}>
                        <TouchableOpacity
                            style={[styles.card, styles.editSongCard]}
                            activeOpacity={0.8}
                            onPress={() => {
                                navigation?.navigate('EditAdmin');
                            }}
                        >
                            <View style={[styles.iconCircle, styles.editSongIconCircle]}>
                                <Feather name="edit-2" size={24} color="#FFFFFF" />
                            </View>
                            <View style={styles.cardFooter}>
                                <Text style={styles.cardTitle}>Edit Song</Text>
                                <Feather name="chevron-right" size={24} color="#1E1E1E" />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.card, styles.searchUserCard]}
                            activeOpacity={0.8}
                            onPress={() => {
                                navigation?.navigate('SearchUser');
                            }}
                        >
                            <View style={[styles.iconCircle, styles.searchUserIconCircle]}>
                                <Feather name="users" size={26} color="#FFFFFF" />
                            </View>
                            <View style={styles.cardFooter}>
                                <Text style={styles.cardTitle}>Search User</Text>
                                <Feather name="chevron-right" size={24} color="#1E1E1E" />
                            </View>
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
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginBottom: 20,
    },
    profileButton: {
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
    titleContainer: {
        marginBottom: 32,
        paddingLeft: 4,
    },
    appTitle: {
        fontSize: 42,
        fontWeight: '900',
        color: '#111827',
        letterSpacing: -0.5,
    },
    appTitleHighlight: {
        color: '#556AB0',
    },
    searchContainer: {
        marginBottom: 28,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 30,
        height: 56,
        paddingHorizontal: 18,
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
    gridContainer: {
        width: '100%',
        gap: 16,
    },
    gridRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
    },
    card: {
        flex: 1,
        height: 150,
        borderRadius: 20,
        padding: 16,
        justifyContent: 'space-between',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    addSongCard: {
        backgroundColor: '#D1DCFE',
    },
    updateModelCard: {
        backgroundColor: '#ECE2FE',
    },
    addCategoryCard: {
        backgroundColor: '#95E6C6',
    },
    mostSearchCard: {
        backgroundColor: '#FCD0E3',
    },
    editSongCard: {
        backgroundColor: '#FFE7B8',
    },
    searchUserCard: {
        backgroundColor: '#D6E8F9',
    },
    iconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addSongIconCircle: {
        backgroundColor: '#91AAFD',
    },
    updateModelIconCircle: {
        backgroundColor: '#BA85FE',
    },
    addCategoryIconCircle: {
        backgroundColor: '#35C694',
    },
    mostSearchIconCircle: {
        backgroundColor: '#F788BC',
    },
    editSongIconCircle: {
        backgroundColor: '#F5B041',
    },
    searchUserIconCircle: {
        backgroundColor: '#6CA6D9',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
});

export default Homeadmin;
