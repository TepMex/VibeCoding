import java.io.File

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

extra["sideloadPropertyPrefix"] = "sttplayerdroid"
apply(from = rootProject.file("../android/sideload-signing.gradle.kts"))

val autoVersionCode: Int = extra["autoVersionCode"] as Int
val useCustomSigning: Boolean = extra["useCustomSigning"] as Boolean
// Capture on the project before android {} — nested DSL receivers shadow `extra` on AGP 9.
val sideloadStoreFile: File? = if (useCustomSigning) extra["sideloadStoreFile"] as File else null
val sideloadStorePassword: String? = if (useCustomSigning) extra["sideloadStorePassword"] as String else null
val sideloadKeyAlias: String? = if (useCustomSigning) extra["sideloadKeyAlias"] as String else null
val sideloadKeyPassword: String? = if (useCustomSigning) extra["sideloadKeyPassword"] as String else null

android {
    namespace = "com.tepmex.sttplayerdroid"
    compileSdk = 36
    ndkVersion = "28.2.13676358"

    signingConfigs {
        if (useCustomSigning) {
            create("sideload") {
                storeFile = sideloadStoreFile
                storePassword = sideloadStorePassword
                keyAlias = sideloadKeyAlias
                keyPassword = sideloadKeyPassword
            }
        }
    }

    defaultConfig {
        applicationId = "com.tepmex.sttplayerdroid"
        minSdk = 31
        targetSdk = 35
        versionCode = autoVersionCode
        versionName = "1.0.$autoVersionCode"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        ndk { abiFilters += "arm64-v8a" }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            signingConfig = if (useCustomSigning) {
                signingConfigs.getByName("sideload")
            } else {
                signingConfigs.getByName("debug")
            }
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = if (useCustomSigning) {
                signingConfigs.getByName("sideload")
            } else {
                signingConfigs.getByName("debug")
            }
        }
        create("benchmark") {
            initWith(getByName("release"))
            matchingFallbacks += "release"
            isDebuggable = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }
    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }
    packaging { resources.excludes += setOf("META-INF/LICENSE*", "META-INF/NOTICE*") }
    testOptions { unitTests.isReturnDefaultValues = true }
}

ksp { arg("room.schemaLocation", "$projectDir/schemas") }

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.core)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime)
    implementation(libs.androidx.lifecycle.viewmodel)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.icons)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.androidx.work)
    implementation(libs.androidx.media3.common)
    implementation(libs.androidx.media3.exoplayer)
    implementation(libs.androidx.media3.session)
    implementation(libs.androidx.media3.ui)
    implementation(libs.litert)
    implementation(libs.coroutines.core)
    implementation(libs.coroutines.android)
    implementation(libs.jsoup)

    testImplementation(libs.junit)
    testImplementation(libs.room.testing)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.robolectric)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.junit)
    androidTestImplementation(libs.espresso)
    androidTestImplementation(libs.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.ui.test.manifest)
}
