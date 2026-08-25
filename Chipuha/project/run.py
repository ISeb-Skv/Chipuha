from app import create_app
from app.extensions import socketio
import os

app = create_app()

if __name__ == '__main__':
    if not os.path.exists('cert.pem') or not os.path.exists('key.pem'):
        print("Создаём самоподписанный сертификат...")
        try:
            from cryptography import x509
            from cryptography.x509.oid import NameOID
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.primitives.asymmetric import rsa
            from cryptography.hazmat.primitives import serialization
            from datetime import datetime, timedelta

            private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            subject = issuer = x509.Name([
                x509.NameAttribute(NameOID.COMMON_NAME, u"localhost"),
            ])
            cert = x509.CertificateBuilder().subject_name(
                subject
            ).issuer_name(
                issuer
            ).public_key(
                private_key.public_key()
            ).serial_number(
                x509.random_serial_number()
            ).not_valid_before(
                datetime.utcnow()
            ).not_valid_after(
                datetime.utcnow() + timedelta(days=365)
            ).add_extension(
                x509.SubjectAlternativeName([
                    x509.DNSName(u"localhost"),
                    x509.DNSName(u"127.0.0.1"),
                ]),
                critical=False,
            ).sign(private_key, hashes.SHA256())

            with open("cert.pem", "wb") as f:
                f.write(cert.public_bytes(serialization.Encoding.PEM))
            with open("key.pem", "wb") as f:
                f.write(private_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.TraditionalOpenSSL,
                    encryption_algorithm=serialization.NoEncryption()
                ))
            print("Сертификат создан.")
        except ImportError:
            print("Библиотека cryptography не установлена. Установите её: pip install cryptography")
            exit(1)

    print("=" * 50)
    print("Запуск сервера...")
    print("Локально: https://127.0.0.1:8080")
    print("=" * 50)

    socketio.run(
        app,
        host='26.15.56.90',
        port=8080,
        ssl_context=('cert.pem', 'key.pem'),
        debug=True
    )