# VSCode Quicky

VSCode Quicky, JavaScript ve TypeScript dosyalarındaki "references" CodeLens özelliğini tek tıkla yönetebilmeniz için hazırlanmış basit bir eklentidir.

## Kurulum

```bash
npm install
npm run compile
```

Ardından proje klasörünü VS Code ile açıp **Run and Debug** panelinden "Launch Extension" hedefini çalıştırarak eklentiyi deneyebilirsiniz.

## Kullanım

1. Herhangi bir JavaScript veya TypeScript dosyasını açın.
2. Editör sekmesinin sağ üst köşesinde beliren ikonuna tıklayın.
3. Açılan context menüsündeki seçenekleri işaretleyerek ilgili CodeLens ayarını açıp kapatın.

Seçili ayarlar etkinleştirilir; diğerleri devre dışı bırakılır. Değişiklikler aktif workspace (varsa workspace klasörü, yoksa kullanıcı ayarları) içinde saklanır.
