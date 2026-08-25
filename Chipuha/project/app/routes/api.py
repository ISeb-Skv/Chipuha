from flask import Blueprint, request, jsonify, session, redirect, url_for, render_template
from app.models.user import users, save_users
import hashlib

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        if not username or not password:
            return jsonify({'error': 'Заполните все поля'}), 400
        hashed = hashlib.sha256(password.encode()).hexdigest()
        if username in users and users[username].get('password') == hashed:
            session['username'] = username
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'Неверный логин или пароль'}), 401
    return render_template('login.html')

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        if not username or not password:
            return jsonify({'error': 'Заполните все поля'}), 400
        if username in users:
            return jsonify({'error': 'Данный никнейм уже занят'}), 400
        users[username] = {
            'password': hashlib.sha256(password.encode()).hexdigest(),
            'previous_nicks': []
        }
        save_users(users)
        return jsonify({'success': True})
    return render_template('register.html')

@auth_bp.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('auth.login'))