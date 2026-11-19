plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val buildNumber = (System.getenv("BUILD_NUMBER") ?: "1").toInt()

android {
    namespace = "com.mmarket.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.mmarket.app"
        minSdk = 26
        targetSdk = 34
        versionCode = buildNumber
        versionName = "1.0.$buildNumber"
    }

    signingConfigs {
        create("release") {
            // Personal app: a fixed key is kept in the repo so every new APK installs over the old one.
            storeFile = file("m-market.keystore")
            storePassword = "mmarket123"
            keyAlias = "mmarket"
            keyPassword = "mmarket123"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}
