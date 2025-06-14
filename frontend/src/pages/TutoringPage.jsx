import React, { useRef, useState, useEffect } from 'react';
import './tutoring.css';
import AuthenticatedNavbar from '../components/AuthenticatedNavbar';
import Footer from '../components/Footer';

// Image imports
import crucialImage from '../assets/crucial.jpeg';
import the7HabitsImage from '../assets/The7Habits.jpeg';
import TheRoad from '../assets/TheRoad.jpg';
import Atomic from '../assets/Atomic.jpeg';
import Man from '../assets/Mans_Search.jpg';
import Never from '../assets/Never.jpg';
import Difficult from '../assets/Difficult.png';
import Just from '../assets/JustLIsten.jpg';
import Talk from '../assets/Talk.jpg';
import Daring from '../assets/Daring.jpg';
import Habit from '../assets/Habit.jpg';
import Now from '../assets/Now.jpg';
import Call from '../assets/Callit.jpg';
import Marsh from '../assets/marsh.jpg';
import Path from '../assets/path.jpg';

const videoCategories = [
  {
    title: "Communication Skills",
    videos: [
      { id: "YJXUOJKtn8o", title: "How to Speak Confidently", description: "Learn techniques to improve your public speaking." },
      { id: "aDMtx5ivKK0", title: "Effective Listening Skills", description: "Master active listening for better communication." },
      { id: "HAnw168huqA", title: "Communication Techniques", description: "Think Fast, Talk Smart" },
      { id: "F4Zu5ZZAG7I", title: "Conversations", description: "7 Ways to Make a Conversation With Anyone" },
      { id: "S3lczaxflNI", title: "How To Cure Your Fears Forever", description: "Manoj Vasudevan, World Champion of Public Speaking 2017" },
      { id: "X3Fz_Gu5WUE", title: "Communication Skills SIMPLIFIED", description: "A Step by Step Roadmap for Success" }
    ]
  },
  {
    title: "Personal Development",
    videos: [
      { id: "ZywgvFSnH38", title: "Goal Setting Strategies", description: "Set and achieve your personal goals effectively." },
      { id: "W8B0KWmv_-Q", title: "Time Management", description: "Boost productivity with effective time management." },
      { id: "G1eHJ9DdoEA", title: "Building Self-Discipline", description: "Develop habits for long-term success." },
      { id: "sCQ0VYNCmKw", title: "How to Be Consistent", description: "A Simple Secret to Personal Development" },
      { id: "cFLjudWTuGQ", title: "Make Body Language Your Superpower", description: "A Simple Secret to Personal Development" },
      { id: "eIho2S0ZahI", title: "Body Language Tips", description: "Enhance your non-verbal communication." }
    ]
  },
  {
    title: "Character Building",
    videos: [
      { id: "AAINqHf-0CA", title: "Developing Resilience", description: "Learn to bounce back from setbacks." },
      { id: "OLBm0P90Lac", title: "Cultivating Empathy", description: "Build stronger relationships through empathy." },
      { id: "zKsq1PJk6Ec", title: "Integrity in Action", description: "Live with honesty and strong moral principles." },
      { id: "qYvXk_bqlBk", title: "Who are you?", description: "The puzzle of personality | Brian Little" },
      { id: "56Zb_TLhPOw", title: "How to Grow as a Person", description: "Johnny Crowder | TEDxEustis" }
    ]
  }
];

const bookRecommendations = [
  {
    category: "Communication Skills",
    books: [
      { title: "Crucial Conversations", author: "Kerry Patterson et al.", imageUrl: crucialImage, bookUrl: "https://www.google.co.in/books/edition/Crucial_Conversations_Tools_for_Talking/VhkQpRH9D9gC?hl=en&gbpv=0&kptab=getbook" },
      { title: "Never Split the Difference", author: "Chris Voss", imageUrl: Never, bookUrl: "https://www.google.co.in/books/edition/Never_Split_the_Difference/TL8CCwAAQBAJ?hl=en&gbpv=0" },
      { title: "Difficult Conversations", author: "Bruce Patton, Douglas Stone, and Sheila Heen", imageUrl: Difficult, bookUrl: "https://www.google.co.in/books/edition/Difficult_Conversations/EjjCEAAAQBAJ?hl=en&gbpv=1&dq=%22Difficult+Conversations%22&printsec=frontcover" },
      { title: "Just Listen", author: "Mark Goulston", imageUrl: Just, bookUrl: "https://www.google.co.in/books/edition/Just_Listen/YbFrqFfBQ0oC?hl=en" },
      { title: "Talk Like TED", author: "Carmine Gallo", imageUrl: Talk, bookUrl: "https://www.google.co.in/books/edition/Talk_Like_TED/upebAgAAQBAJ?hl=en&gbpv=1&dq=Talk+Like+TED%22,+++++++++++++++++author:+%22Carmine+Gallo%22&printsec=frontcover" }
    ]
  },
  {
    category: "Personal Development",
    books: [
      { title: "Atomic Habits", author: "James Clear", imageUrl: Atomic, bookUrl: "https://www.google.co.in/books/edition/Atomic_Habits/eoIIzAEACAAJ?hl=en" },
      { title: "The 7 Habits of Highly Effective People", author: "Stephen R. Covey", imageUrl: the7HabitsImage, bookUrl: "https://www.google.co.in/books/edition/The_7_Habits_of_Highly_Effective_People/upUxaNWSaRIC?hl=en&gbpv=1&dq=%22The+7+Habits+of+Highly_Effective+People%22,&printsec=frontcover" },
      { title: "The Power of Now", author: "Eckhart Tolle", imageUrl: Now, bookUrl: "https://www.google.co.in/books/edition/The_Power_of_Now/sQYqRCIhFAMC?hl=en&gbpv=0" },
      { title: "The Power of Habit", author: "Charles Duhigg", imageUrl: Habit, bookUrl: "https://www.google.co.in/books/edition/The_Power_of_Habit/O1MInVXd_aoC?hl=en" },
      { title: "Daring Greatly", author: "Brené Brown", imageUrl: Daring, bookUrl: "https://www.google.co.in/books/edition/Daring_Greatly/xVj7yAEACAAJ?hl=en&gbpv=1&dq=Daring+Greatly+Brene+Brown&printsec=frontcover" }
    ]
  },
  {
    category: "Character Building",
    books: [
      { title: "Man's Search for Meaning", author: "Viktor E. Frankl", imageUrl: Man, bookUrl: "https://www.google.co.in/books/edition/Man_s_Search_for_Meaning/7b9nnhQkHDEC?hl=en" },
      { title: "The Road to Character", author: "David Brooks", imageUrl: TheRoad, bookUrl: "https://www.google.co.in/books/edition/The_Road_to_Character/mz63BQAAQBAJ?hl=en&gbpv=1" },
      { title: "Call It Courage", author: "Armstrong Sperry", imageUrl: Call, bookUrl: "https://www.google.co.in/books/edition/Call_It_Courage/uq8PB04n23sC?hl=en&gbpv=1&printsec=frontcover" },
      { title: "The Path to Purpose", author: "William Damon", imageUrl: Path, bookUrl: "https://www.google.co.in/books/edition/The_Path_to_Purpose/QT4KuW2bOzkC?hl=en&gbpv=0" },
      { title: "The Marshmallow Test", author: "Walter Mischel", imageUrl: Marsh, bookUrl: "https://www.google.co.in/books/edition/The_Marshmallow_Test/Pg2rAwAAQBAJ?hl=en&gbpv=1&dq=marshmallow&printsec=frontcover" }
    ]
  }
];

// Spinner component for loading state
const LoadingSpinner = () => (
  <div className="loading-overlay" aria-live="polite">
    <div className="spinner"></div>
    <span className="sr-only">Loading content...</span>
  </div>
);

const VideoSection = ({ category }) => {
  const scrollRef = useRef(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(true);

  const checkScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      const atEnd = scrollLeft + clientWidth >= scrollWidth - 2;
      setShowLeftScroll(scrollLeft > 2);
      setShowRightScroll(!atEnd);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    const currentRef = scrollRef.current;
    if (currentRef) {
      currentRef.addEventListener('scroll', checkScrollButtons);
      window.addEventListener('resize', checkScrollButtons);
    }
    return () => {
      if (currentRef) {
        currentRef.removeEventListener('scroll', checkScrollButtons);
        window.removeEventListener('resize', checkScrollButtons);
      }
    };
  }, []);

  const scrollByAmount = (direction) => {
    if (scrollRef.current) {
      const cardWidth = scrollRef.current.querySelector('.video-card')?.offsetWidth || 320;
      const gap = 16;
      const scrollAmount = cardWidth + gap;
      scrollRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="video-section" data-tilt data-tilt-max="10">
      <h2 className="section-title">{category.title}</h2>
      <div className="scrollable-wrapper">
        {showLeftScroll && (
          <button
            className="scroll-button left"
            onClick={() => scrollByAmount('left')}
            aria-label="Scroll videos left"
            data-tilt
            data-tilt-max="10"
          >
            ←
          </button>
        )}
        <div className="scrollable-container" ref={scrollRef}>
          {category.videos.map((video, index) => (
            <div key={`${video.id}-${index}`} className="video-card" data-tilt data-tilt-max="10" role="region" aria-label={`Video: ${video.title}`}>
              <div className="video-iframe-container">
                <iframe
                  className="video-iframe"
                  src={`https://www.youtube.com/embed/${video.id}`}
                  title={video.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const parent = e.target.closest('.video-iframe-container');
                    if (parent) {
                      const fallbackDiv = document.createElement('div');
                      fallbackDiv.className = 'video-unavailable-fallback';
                      fallbackDiv.innerHTML = '<p>Video Unavailable</p><p>Please check the video ID or try again later.</p>';
                      parent.appendChild(fallbackDiv);
                    }
                  }}
                ></iframe>
              </div>
              <div className="video-content">
                <h3 className="video-title">{video.title}</h3>
                <p className="video-description">{video.description}</p>
              </div>
            </div>
          ))}
        </div>
        {showRightScroll && (
          <button
            className="scroll-button right"
            onClick={() => scrollByAmount('right')}
            aria-label="Scroll videos right"
            data-tilt
            data-tilt-max="10"
          >
            →
          </button>
        )}
      </div>
    </section>
  );
};

const BookSection = ({ category }) => {
  const scrollRef = useRef(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(true);

  const checkScrollButtons = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      const atEnd = scrollLeft + clientWidth >= scrollWidth - 2;
      setShowLeftScroll(scrollLeft > 2);
      setShowRightScroll(!atEnd);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    const currentRef = scrollRef.current;
    if (currentRef) {
      currentRef.addEventListener('scroll', checkScrollButtons);
      window.addEventListener('resize', checkScrollButtons);
    }
    return () => {
      if (currentRef) {
        currentRef.removeEventListener('scroll', checkScrollButtons);
        window.removeEventListener('resize', checkScrollButtons);
      }
    };
  }, []);

  const scrollByAmount = (direction) => {
    if (scrollRef.current) {
      const cardWidth = scrollRef.current.querySelector('.book-item')?.offsetWidth || 180;
      const gap = 16;
      const scrollAmount = cardWidth + gap;
      scrollRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="books-section" data-tilt data-tilt-max="10">
      <h2 className="section-title">{category.category}</h2>
      <div className="scrollable-wrapper">
        {showLeftScroll && (
          <button
            className="scroll-button left"
            onClick={() => scrollByAmount('left')}
            aria-label="Scroll books left"
            data-tilt
            data-tilt-max="10"
          >
            ←
          </button>
        )}
        <div className="scrollable-container" ref={scrollRef}>
          {category.books.map((book, idx) => (
            <a
              href={book.bookUrl}
              target="_blank"
              rel="noopener noreferrer"
              key={idx}
              className="book-item-link"
              aria-label={`View ${book.title} by ${book.author}`}
            >
              <div className="book-item" data-tilt data-tilt-max="10">
                <img
                  src={book.imageUrl}
                  alt={`${book.title} cover`}
                  className="book-image"
                  loading="lazy"
                  onError={(e) => {
                    e.target.src = 'https://placehold.co/150x200/212529/ced4da?text=No+Cover';
                    e.target.alt = 'No cover available';
                  }}
                />
                <p className="book-title">{book.title}</p>
                <p className="book-author">by {book.author}</p>
              </div>
            </a>
          ))}
        </div>
        {showRightScroll && (
          <button
            className="scroll-button right"
            onClick={() => scrollByAmount('right')}
            aria-label="Scroll books right"
            data-tilt
            data-tilt-max="10"
          >
            →
          </button>
        )}
      </div>
    </section>
  );
};

const TutoringPage = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="tutor-page-wrapper">
      <AuthenticatedNavbar />
      <div className="container">
        <h1 className="main-title" data-tilt data-tilt-max="10">Personal Development Hub</h1>
        {videoCategories.map((category, index) => (
          <VideoSection key={index} category={category} />
        ))}
        {bookRecommendations.map((category, index) => (
          <BookSection key={index} category={category} />
        ))}
        <div className="tutoring-page-disclaimer" data-tilt data-tilt-max="10">
          <p>Content is for educational purposes only. All rights belong to their respective owners.</p>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default TutoringPage;