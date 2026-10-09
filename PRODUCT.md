# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Electron masaüstü uygulaması; arayüz React + Tailwind ile çizilir. Ayrıca aynı motoru kullanan bir CLI var.)

## Users

Tek kullanıcı: aracı yazan geliştirici (Hazallul). Yeni bir projeye başlarken başka bir site, derleyici ya da
sihirbaz açmadan ilk yapıyı kurmak, sonra projeyi VS Code'da açıp kodu okuyarak geliştirmek istiyor.
Araç aynı zamanda portfolyoda gösterilecek bir proje.

## Product Purpose

Bir projeye başlamanın ilk saatini sıfıra indirmek: proje türünü seç, gerekenleri işaretle, tek tıkla çalışan bir
başlangıç projesi al. Başarı ölçüsü: oluşturulan proje ilk denemede çalışır, okunabilir ve geliştirmeye hazırdır.

## Positioning

start.spring.io, create-vite ve benzeri araçlar tek bir yığını kurar. create-hazal-app birden fazla yığını
(Spring Boot backend, frontend framework'leri, Python projeleri) tek arayüzde birleştirir, Docker, veritabanı,
.env ve VS Code ayarlarını da hazırlar ve projeyi çalışır halde teslim eder.

## Operating Context

- Windows masaüstü; Smart App Control açık olabilir (imzasız exe engellenir).
- Docker Desktop, Node.js, Python ve Git bilgisayarda kurulu olabilir ya da olmayabilir; araç durumu gösterir.
- Akış: aç → proje türünü seç → ayarla → oluştur (canlı ilerleme ve log) → VS Code'da aç.

## Capabilities and Constraints

- Proje türleri: Fullstack web (Spring Boot + frontend), REST API (Spring Boot), sadece frontend web sitesi,
  Python (oyun/simülasyon, FastAPI, konsol uygulaması / exe).
- Açılışta proje türü kartlarla sorulur; Python tek kart, içindekiler tıklamadan önce görünür, alt türler
  kartın içinden seçilir.
- Spring kataloğu start.spring.io'dan canlı gelir; internet yoksa önbellek / gömülü kopya.
- Arayüz dili Türkçe.

## Brand Commitments

- Ad: create-hazal-app. Uygulama ikonu `build/icon.png`.

## Evidence on Hand

- README.md: desteklenen seçenekler ve gerçekten Docker'da doğrulanmış senaryolar.
- Uydurma kullanıcı yorumu, indirme sayısı ya da benchmark yok; eklenmemeli.

## Product Principles

1. Çalışan proje teslim et: üretilen her şablon gerçekten derlenip çalıştırılarak doğrulanır.
2. Sade dil: seçenekler "ne işe yarar / ne zaman seçilir" diye anlatılır, jargon açıklanır.
3. Sürpriz yok: ne üretileceği oluşturmadan önce canlı önizlemede görünür.
4. Okunabilir çıktı: üretilen kod, kullanıcının VS Code'da okuyup geliştireceği kadar sade ve açıklamalı.
