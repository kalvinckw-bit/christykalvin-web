plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.christykalvin.signalscout"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.christykalvin.signalscout"
        minSdk = 29
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

        // Firebase 公開 web config，設計上即可公開於用戶端；真正的保護來自 Firestore 安全規則。
        buildConfigField("String", "FIREBASE_API_KEY", "\"AIzaSyD4ZyFyEvnTIE2sBwi83Pre_6kdrdTB6Rw\"")
        buildConfigField("String", "FIREBASE_PROJECT_ID", "\"voiceout-asia\"")
        buildConfigField("String", "FIRESTORE_DATABASE_ID", "\"christykalvin-db\"")
        buildConfigField("String", "FIRESTORE_COLLECTION", "\"signal_reports\"")
    }

    buildFeatures {
        buildConfig = true
        viewBinding = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
