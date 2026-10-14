import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, Text } from '../../../../components';
import type { AdminCourse, CourseInput } from '../data/useAdminCourses';
import { useAssignableInstructors } from '../data/useCourseInstructors';
import styles from './CourseForm.module.css';

interface CourseFormProps {
  course?: AdminCourse;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (input: CourseInput) => Promise<void>;
}

const levelOptions = ['Başlangıç', 'Orta', 'İleri'];

export function CourseForm({ course, saving, onCancel, onSubmit }: CourseFormProps) {
  const [title, setTitle] = useState(course?.title ?? '');
  const [description, setDescription] = useState(course?.description ?? '');
  const [category, setCategory] = useState(course?.category ?? '');
  const [level, setLevel] = useState(course?.level ?? levelOptions[0]);
  const [tagsText, setTagsText] = useState(course?.tags.join(', ') ?? '');
  const [accessMode, setAccessMode] = useState(course?.accessMode ?? 'SEQUENTIAL');
  const [status, setStatus] = useState(course?.status ?? 'DRAFT');
  // TL cinsinden metin; boş veya 0 = ücretsiz. Sunucuya kuruş olarak gider.
  const [priceText, setPriceText] = useState(course?.priceKurus ? (course.priceKurus / 100).toFixed(2) : '');
  // Eğitmen seçimi yalnızca oluşturmada (kurs yönetimi ADMIN'e özeldir).
  const isCreate = !course;
  const { pool } = useAssignableInstructors();
  const [instructorIds, setInstructorIds] = useState<string[]>([]);

  const toggleInstructor = (id: string) =>
    setInstructorIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const tags = tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      level,
      tags,
      accessMode,
      status,
      priceKurus: Math.round(Number(priceText.replace(',', '.') || '0') * 100),
      ...(isCreate && instructorIds.length > 0 ? { instructorIds } : {}),
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <Text role="label-md" as="span" tone="muted">
          Başlık
        </Text>
        <input
          className={styles.input}
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={2}
        />
      </label>

      <label className={styles.field}>
        <Text role="label-md" as="span" tone="muted">
          Açıklama
        </Text>
        <textarea
          className={styles.textarea}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
        />
      </label>

      <div className={styles.row}>
        <label className={styles.field}>
          <Text role="label-md" as="span" tone="muted">
            Kategori
          </Text>
          <input
            className={styles.input}
            type="text"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            required
          />
        </label>

        <label className={styles.field}>
          <Text role="label-md" as="span" tone="muted">
            Seviye
          </Text>
          <select
            className={styles.input}
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            {levelOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={styles.field}>
        <Text role="label-md" as="span" tone="muted">
          Etiketler (virgülle ayırın)
        </Text>
        <input
          className={styles.input}
          type="text"
          value={tagsText}
          onChange={(event) => setTagsText(event.target.value)}
          placeholder="örn. react, frontend"
        />
      </label>

      <div className={styles.row}>
        <label className={styles.field}>
          <Text role="label-md" as="span" tone="muted">
            Erişim Modu
          </Text>
          <select
            className={styles.input}
            value={accessMode}
            onChange={(event) => setAccessMode(event.target.value as CourseInput['accessMode'])}
          >
            <option value="SEQUENTIAL">Sıralı Erişim</option>
            <option value="FREE">Serbest Erişim</option>
          </select>
        </label>

        <label className={styles.field}>
          <Text role="label-md" as="span" tone="muted">
            Durum
          </Text>
          <select
            className={styles.input}
            value={status}
            onChange={(event) => setStatus(event.target.value as NonNullable<CourseInput['status']>)}
          >
            <option value="DRAFT">Taslak</option>
            <option value="PUBLISHED">Yayınlandı</option>
          </select>
        </label>

        <label className={styles.field}>
          <Text role="label-md" as="span" tone="muted">
            Fiyat (TL)
          </Text>
          <input
            className={styles.input}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={priceText}
            onChange={(event) => setPriceText(event.target.value)}
            placeholder="Boş = ücretsiz"
          />
        </label>
      </div>

      {isCreate && pool.length > 0 && (
        <fieldset className={styles.fieldset}>
          <legend>
            <Text role="label-md" as="span" tone="muted">
              Eğitmenler (isteğe bağlı)
            </Text>
          </legend>
          {pool.map((instructor) => (
            <label key={instructor.id} className={styles.checkbox}>
              <input
                type="checkbox"
                checked={instructorIds.includes(instructor.id)}
                onChange={() => toggleInstructor(instructor.id)}
              />
              <Text role="body-md" as="span">
                {instructor.name}
              </Text>
            </label>
          ))}
        </fieldset>
      )}

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Vazgeç
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Kaydediliyor…' : course ? 'Güncelle' : 'Oluştur'}
        </Button>
      </div>
    </form>
  );
}
