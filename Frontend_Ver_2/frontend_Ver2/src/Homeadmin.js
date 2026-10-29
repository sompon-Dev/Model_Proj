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

const Homeadmin = ({ navigation }) => {
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header Profile Icon */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.profileButton}
                        activeOpacity={0.7}
                        onPress={() => navigation?.navigate('AdminProfile')}
                    >
                        <Feather name="user" size={24} color="#1E1E1E" />
                    </TouchableOpacity>
                </View>

                {/* App Title */}
                <View style={styles.titleContainer}>
                    <Text style={styles.appTitle}>
                        Lyri<Text style={styles.appTitleHighlight}>Seek</Text>
                    </Text>
                </View>

                {/* Search Bar */}
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

                {/* 2x2 Grid Menu */}
                <View style={styles.gridContainer}>
                    {/* Row 1 */}
                    <View style={styles.gridRow}>
                        {/* Add Song Card */}
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
                                <Text style={styles.cardTitle}>Add Song</Text>
                                <Feather name="chevron-right" size={24} color="#1E1E1E" />
                            </View>
                        </TouchableOpacity>

                        {/* Update Model Card */}
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

                    {/* Row 2 */}
                    <View style={styles.gridRow}>
                        {/* Add Category Card */}
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

                        {/* Most Search Card */}
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
